import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsPreflightResponse, jsonResponse } from "../_shared/cors.ts";
import { createSignedDownloads } from "../_shared/checkout.ts";

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
  const orderId = body?.order_id;
  const orderItemId = body?.order_item_id ?? null;
  if (!orderId || typeof orderId !== "string") {
    return jsonResponse({ error: "Missing or invalid order_id" }, 400);
  }
  if (orderItemId != null && typeof orderItemId !== "string") {
    return jsonResponse({ error: "Invalid order_item_id" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id,user_id,status,design_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr) return jsonResponse({ error: orderErr.message }, 400);
  if (!order) return jsonResponse({ error: "Order not found" }, 404);
  if (order.user_id !== user.id) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }
  if (order.status !== "paid") {
    return jsonResponse({ error: "Order not paid" }, 400);
  }

  const { downloads, signed_url, error: dlErr } = await createSignedDownloads(
    supabase,
    order,
    { orderItemId },
  );
  if (dlErr) return jsonResponse({ error: dlErr }, 400);

  return jsonResponse({
    order_id: order.id,
    signed_url,
    downloads,
  });
});
