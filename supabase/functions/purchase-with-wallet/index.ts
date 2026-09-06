import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveOffer } from "../_shared/offers.ts";
import {
  clearUserCart,
  createSignedDownloads,
  insertOrderItems,
  resolveCheckoutLines,
  sumLinePrices,
} from "../_shared/checkout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { user: null, error: "Unauthorized", supabase: null };
  }

  const jwt = authHeader.slice("Bearer ".length);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { user: null, error: "Server not configured", supabase: null };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) {
    return { user: null, error: error?.message || "Unauthorized", supabase: null };
  }

  return { user: data.user, error: null, supabase };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...corsHeaders } });
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

  if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
    return jsonResponse(
      {
        error:
          finalAmount === 0
            ? "This order is free — use the free download checkout instead of wallet."
            : "Invalid payable amount after offer",
      },
      400,
    );
  }

  const note = fromCart
    ? `Wallet purchase for cart (${lines.length} designs)`
    : `Wallet purchase for design ${lines[0].design_id}`;

  const { data: txId, error: debitErr } = await supabase.rpc("adjust_wallet_balance", {
    p_user_id: user.id,
    p_amount: -finalAmount,
    p_type: "purchase_debit",
    p_reference_order_id: null,
    p_note: note,
    p_created_by: null,
  });

  if (debitErr) {
    const msg = debitErr.message || "Wallet debit failed";
    const status = msg.toLowerCase().includes("insufficient") ? 400 : 500;
    return jsonResponse({ error: msg }, status);
  }

  const { data: order, error: insertErr } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      design_id: lines[0].design_id,
      amount: finalAmount,
      status: "paid",
      payment_method: "wallet",
      offer_id: offerId,
      offer_usage_counted: false,
    })
    .select("id, design_id")
    .single();

  if (insertErr || !order) {
    await supabase.rpc("adjust_wallet_balance", {
      p_user_id: user.id,
      p_amount: finalAmount,
      p_type: "refund",
      p_reference_order_id: null,
      p_note: "Auto-refund: order insert failed after wallet debit",
      p_created_by: null,
    });
    return jsonResponse({ error: insertErr?.message || "Failed to create order" }, 500);
  }

  const { error: itemsErr } = await insertOrderItems(supabase, order.id, lines);
  if (itemsErr) {
    await supabase.rpc("adjust_wallet_balance", {
      p_user_id: user.id,
      p_amount: finalAmount,
      p_type: "refund",
      p_reference_order_id: order.id,
      p_note: "Auto-refund: order_items insert failed",
      p_created_by: null,
    });
    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
    return jsonResponse({ error: itemsErr }, 500);
  }

  if (txId) {
    await supabase
      .from("wallet_transactions")
      .update({ reference_order_id: order.id })
      .eq("id", txId);
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .maybeSingle();

  return jsonResponse({
    order_id: order.id,
    signed_url,
    downloads,
    final_amount: finalAmount,
    original_amount: originalAmount,
    discount_amount: offerResult.applicable ? offerResult.discount_amount : 0,
    wallet_balance: profile?.wallet_balance ?? null,
    payment_method: "wallet",
    item_count: lines.length,
  });
});
