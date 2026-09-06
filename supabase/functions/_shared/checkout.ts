import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type CheckoutLine = {
  design_id: string;
  name: string;
  price: number;
  design_file_url: string;
};

export type DownloadRow = {
  order_item_id: string;
  design_id: string;
  design_name: string;
  signed_url: string;
};

function asNumber(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/** Resolve buy-now (one design) or cart lines. Always re-loads prices from DB. */
export async function resolveCheckoutLines(
  supabase: SupabaseClient,
  opts: { userId: string; designId?: string | null; fromCart?: boolean },
): Promise<{ lines: CheckoutLine[]; error: string | null; status: number }> {
  if (opts.fromCart && opts.designId) {
    return {
      lines: [],
      error: "Pass either design_id or from_cart, not both",
      status: 400,
    };
  }

  if (opts.fromCart) {
    const { data: cartRows, error: cartErr } = await supabase
      .from("cart_items")
      .select("design_id, designs(id, name, price, design_file_url, is_active)")
      .eq("user_id", opts.userId);

    if (cartErr) return { lines: [], error: cartErr.message, status: 400 };
    if (!cartRows?.length) {
      return { lines: [], error: "Your cart is empty", status: 400 };
    }

    const lines: CheckoutLine[] = [];
    for (const row of cartRows) {
      const d = row.designs as
        | {
          id: string;
          name: string;
          price: number | string;
          design_file_url: string | null;
          is_active: boolean;
        }
        | null;
      if (!d?.id || !d.is_active) {
        return {
          lines: [],
          error: "A design in your cart is no longer available. Remove it and try again.",
          status: 400,
        };
      }
      if (!d.design_file_url) {
        return {
          lines: [],
          error: `Design file is missing for “${d.name}”. Remove it from the cart.`,
          status: 400,
        };
      }
      const price = asNumber(d.price);
      if (!Number.isFinite(price) || price <= 0) {
        return {
          lines: [],
          error: `Invalid price for “${d.name}”`,
          status: 400,
        };
      }
      lines.push({
        design_id: d.id,
        name: d.name,
        price,
        design_file_url: d.design_file_url,
      });
    }
    return { lines, error: null, status: 200 };
  }

  if (!opts.designId || typeof opts.designId !== "string") {
    return {
      lines: [],
      error: "Missing or invalid design_id (or set from_cart: true)",
      status: 400,
    };
  }

  const { data: design, error: designErr } = await supabase
    .from("designs")
    .select("id, name, price, design_file_url, is_active")
    .eq("id", opts.designId)
    .eq("is_active", true)
    .maybeSingle();

  if (designErr) return { lines: [], error: designErr.message, status: 400 };
  if (!design) return { lines: [], error: "Design not found", status: 404 };
  if (!design.design_file_url) {
    return { lines: [], error: "Design file is missing", status: 400 };
  }

  const price = asNumber(design.price);
  if (!Number.isFinite(price) || price <= 0) {
    return { lines: [], error: "Invalid design price", status: 400 };
  }

  return {
    lines: [{
      design_id: design.id,
      name: design.name,
      price,
      design_file_url: design.design_file_url,
    }],
    error: null,
    status: 200,
  };
}

export function sumLinePrices(lines: CheckoutLine[]): number {
  return lines.reduce((sum, line) => sum + line.price, 0);
}

export async function insertOrderItems(
  supabase: SupabaseClient,
  orderId: string,
  lines: CheckoutLine[],
): Promise<{ error: string | null }> {
  const rows = lines.map((line) => ({
    order_id: orderId,
    design_id: line.design_id,
    unit_price: line.price,
    design_name: line.name,
  }));
  const { error } = await supabase.from("order_items").insert(rows);
  return { error: error?.message ?? null };
}

export async function clearUserCart(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await supabase.from("cart_items").delete().eq("user_id", userId);
}

/** Prefer order_items; fall back to legacy orders.design_id for safety. */
export async function createSignedDownloads(
  supabase: SupabaseClient,
  order: { id: string; design_id: string | null },
  opts?: { orderItemId?: string | null },
): Promise<{ downloads: DownloadRow[]; signed_url: string | null; error: string | null }> {
  let itemsQuery = supabase
    .from("order_items")
    .select("id, design_id, design_name, designs(design_file_url)")
    .eq("order_id", order.id);

  if (opts?.orderItemId) {
    itemsQuery = itemsQuery.eq("id", opts.orderItemId);
  }

  const { data: items, error: itemsErr } = await itemsQuery;
  if (itemsErr) {
    return { downloads: [], signed_url: null, error: itemsErr.message };
  }

  type ItemRow = {
    id: string;
    design_id: string;
    design_name: string | null;
    designs: { design_file_url: string | null } | null;
  };

  let rows: ItemRow[] = (items as ItemRow[] | null) ?? [];

  // Legacy paid orders before backfill ran (or race): synthesize from design_id.
  if (!rows.length && order.design_id) {
    const { data: design, error: designErr } = await supabase
      .from("designs")
      .select("id, name, design_file_url")
      .eq("id", order.design_id)
      .maybeSingle();
    if (designErr) {
      return { downloads: [], signed_url: null, error: designErr.message };
    }
    if (!design?.design_file_url) {
      return { downloads: [], signed_url: null, error: "Design file missing" };
    }
    rows = [{
      id: order.id,
      design_id: design.id,
      design_name: design.name,
      designs: { design_file_url: design.design_file_url },
    }];
  }

  if (!rows.length) {
    return { downloads: [], signed_url: null, error: "No downloadable items on this order" };
  }

  const downloads: DownloadRow[] = [];
  for (const row of rows) {
    const path = row.designs?.design_file_url;
    if (!path) {
      return {
        downloads: [],
        signed_url: null,
        error: `Design file missing for “${row.design_name || row.design_id}”`,
      };
    }
    const { data: signed, error: signedErr } = await supabase.storage
      .from("design-files")
      .createSignedUrl(path, 60 * 10);
    if (signedErr || !signed?.signedUrl) {
      return {
        downloads: [],
        signed_url: null,
        error: signedErr?.message || "Failed to create download link",
      };
    }
    downloads.push({
      order_item_id: row.id,
      design_id: row.design_id,
      design_name: row.design_name || "Design",
      signed_url: signed.signedUrl,
    });
  }

  return {
    downloads,
    signed_url: downloads[0]?.signed_url ?? null,
    error: null,
  };
}
