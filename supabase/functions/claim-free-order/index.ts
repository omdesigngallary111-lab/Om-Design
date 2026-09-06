import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveOffer } from "../_shared/offers.ts";
import { corsPreflightResponse, jsonResponse } from "../_shared/cors.ts";
import {
  clearUserCart,
  createSignedDownloads,
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

  return { user: data.user, error: null, supabase };
}

/**
 * Free / ₹0 checkout — no Razorpay, no wallet debit.
 * Used for zero-priced designs and carts (or 100% off offers).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const { user, error: userError, supabase } = await requireUser(req);
  if (!user || !supabase) {
    return jsonResponse({ error: userError || "Unauthorized" }, 401);
  }

  const body = await req.json().catch(() => null);
  const designId = body?.design_id ?? null;
  const fromCart = body?.from_cart === true;
  const offerCode = body?.offer_code ?? null;

  const { lines, error: linesError, status: linesStatus } =
    await resolveCheckoutLines(supabase, {
      userId: user.id,
      designId,
      fromCart,
    });
  if (linesError) return jsonResponse({ error: linesError }, linesStatus);

  const originalAmount = sumLinePrices(lines);
  const offerResult = await resolveOffer(supabase, originalAmount, offerCode);
  if (offerCode && !offerResult.applicable) {
    return jsonResponse({ error: offerResult.reason || "Offer is not applicable" }, 400);
  }

  const finalAmount = offerResult.applicable ? offerResult.final_amount : originalAmount;
  const offerId = offerResult.applicable ? offerResult.offer_id : null;

  if (!Number.isFinite(finalAmount) || finalAmount < 0) {
    return jsonResponse({ error: "Invalid payable amount" }, 400);
  }
  if (finalAmount > 0) {
    return jsonResponse(
      { error: "This order requires payment. Use Razorpay or wallet checkout." },
      400,
    );
  }

  const { data: order, error: insertErr } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      design_id: lines[0].design_id,
      amount: 0,
      status: "paid",
      payment_method: "free",
      offer_id: offerId,
      offer_usage_counted: false,
    })
    .select("id, design_id")
    .single();

  if (insertErr || !order) {
    return jsonResponse({ error: insertErr?.message || "Failed to create order" }, 500);
  }

  const { error: itemsErr } = await insertOrderItems(supabase, order.id, lines);
  if (itemsErr) {
    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
    return jsonResponse({ error: itemsErr }, 500);
  }

  if (offerId) {
    const { error: usageErr } = await supabase.rpc("consume_order_offer_usage", {
      p_order_id: order.id,
    });
    if (usageErr) {
      return jsonResponse({ error: usageErr.message }, 500);
    }
  }

  const { downloads, signed_url, error: dlErr } = await createSignedDownloads(
    supabase,
    order,
  );
  if (dlErr) return jsonResponse({ error: dlErr }, 500);

  if (fromCart) {
    await clearUserCart(supabase, user.id);
  }

  return jsonResponse({
    order_id: order.id,
    signed_url,
    downloads,
    final_amount: 0,
    original_amount: originalAmount,
    discount_amount: offerResult.applicable ? offerResult.discount_amount : 0,
    payment_method: "free",
    item_count: lines.length,
  });
});
