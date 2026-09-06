import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveOffer } from "../_shared/offers.ts";
import { corsPreflightResponse, jsonResponse } from "../_shared/cors.ts";
import {
  insertOrderItems,
  resolveCheckoutLines,
  sumLinePrices,
} from "../_shared/checkout.ts";

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { user: null, error: "Unauthorized" };
  }

  const jwt = authHeader.slice("Bearer ".length);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { user: null, error: "Server not configured" };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.auth.getUser(jwt);

  if (error || !data?.user) {
    return { user: null, error: error?.message || "Unauthorized" };
  }

  return { user: data.user, error: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const { user, error: userError } = await requireUser(req);
  if (!user) {
    return jsonResponse({ error: userError || "Unauthorized" }, 401);
  }

  const body = await req.json().catch(() => null);
  const designId = body?.design_id ?? null;
  const fromCart = body?.from_cart === true;
  const offerCode = body?.offer_code ?? null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")!;
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { lines, error: linesError, status: linesStatus } =
    await resolveCheckoutLines(supabase, {
      userId: user.id,
      designId,
      fromCart,
    });
  if (linesError) return jsonResponse({ error: linesError }, linesStatus);

  const originalAmount = sumLinePrices(lines);

  // Re-validate offer at charge time — never trust an earlier client preview.
  const offerResult = await resolveOffer(supabase, originalAmount, offerCode);
  if (offerCode && !offerResult.applicable) {
    return jsonResponse({ error: offerResult.reason || "Offer is not applicable" }, 400);
  }

  const finalAmount = offerResult.applicable ? offerResult.final_amount : originalAmount;
  const offerId = offerResult.applicable ? offerResult.offer_id : null;

  if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
    return jsonResponse({ error: "Invalid payable amount after offer" }, 400);
  }

  const amountPaise = Math.round(finalAmount * 100);

  // Razorpay restricts `receipt` length to <= 56 chars.
  const receipt = `r_${user.id.slice(0, 8)}_${Date.now().toString(36)}`;
  const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

  const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      payment_capture: 1,
    }),
  });

  const rpJson = await rpRes.json().catch(() => null);
  if (!rpRes.ok) {
    return jsonResponse(
      { error: "Failed to create Razorpay order", details: rpJson || null },
      502,
    );
  }

  const razorpayOrderId = rpJson?.id;
  if (!razorpayOrderId || typeof razorpayOrderId !== "string") {
    return jsonResponse({ error: "Invalid Razorpay order response" }, 502);
  }

  // Keep design_id = first line for legacy admin/account joins; full list in order_items.
  const { data: order, error: insertErr } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      design_id: lines[0].design_id,
      amount: finalAmount,
      status: "pending",
      razorpay_order_id: razorpayOrderId,
      offer_id: offerId,
      payment_method: "razorpay",
    })
    .select("id")
    .single();

  if (insertErr || !order) {
    return jsonResponse({ error: insertErr?.message || "Failed to create order" }, 500);
  }

  const { error: itemsErr } = await insertOrderItems(supabase, order.id, lines);
  if (itemsErr) {
    await supabase.from("orders").delete().eq("id", order.id);
    return jsonResponse({ error: itemsErr }, 500);
  }

  return jsonResponse({
    order_id: order.id,
    razorpay_order_id: razorpayOrderId,
    amount: amountPaise,
    currency: "INR",
    key_id: razorpayKeyId,
    original_amount: originalAmount,
    discount_amount: offerResult.applicable ? offerResult.discount_amount : 0,
    final_amount: finalAmount,
    item_count: lines.length,
    from_cart: fromCart,
    offer: offerResult.applicable
      ? {
        offer_id: offerResult.offer_id,
        code: offerResult.code,
        discount_percentage: offerResult.discount_percentage,
      }
      : null,
  });
});
