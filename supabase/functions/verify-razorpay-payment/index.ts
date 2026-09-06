import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsPreflightResponse, jsonResponse } from "../_shared/cors.ts";
import { clearUserCart, createSignedDownloads } from "../_shared/checkout.ts";

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

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  const razorpayOrderId = body?.razorpay_order_id;
  const razorpayPaymentId = body?.razorpay_payment_id;
  const razorpaySignature = body?.razorpay_signature;
  const clearCart = body?.clear_cart === true;

  if (
    !razorpayOrderId || typeof razorpayOrderId !== "string" ||
    !razorpayPaymentId || typeof razorpayPaymentId !== "string" ||
    !razorpaySignature || typeof razorpaySignature !== "string"
  ) {
    return jsonResponse({ error: "Missing or invalid payment fields" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id,user_id,status,design_id,razorpay_order_id,offer_id")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();

  if (orderErr) return jsonResponse({ error: orderErr.message }, 400);
  if (!order) return jsonResponse({ error: "Order not found" }, 404);

  if (order.user_id !== user.id) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const message = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = await hmacSha256Hex(razorpayKeySecret, message);

  if (expected.toLowerCase() !== razorpaySignature.toLowerCase()) {
    return jsonResponse({ error: "Signature verification failed" }, 400);
  }

  // Idempotent: already paid (e.g. webhook won the race) — still return downloads.
  if (order.status !== "paid") {
    const { error: paidErr } = await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("id", order.id)
      .neq("status", "paid");

    if (paidErr) return jsonResponse({ error: paidErr.message }, 500);

    if (order.offer_id) {
      const { error: usageErr } = await supabase.rpc("consume_order_offer_usage", {
        p_order_id: order.id,
      });
      if (usageErr) return jsonResponse({ error: usageErr.message }, 500);
    }
  }

  const { downloads, signed_url, error: dlErr } = await createSignedDownloads(
    supabase,
    order,
  );
  if (dlErr) return jsonResponse({ error: dlErr }, 500);

  if (clearCart) {
    await clearUserCart(supabase, user.id);
  }

  return jsonResponse({
    order_id: order.id,
    signed_url,
    downloads,
  });
});
