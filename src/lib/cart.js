import { supabase } from './supabaseClient.js'

const NOT_CONFIGURED_ERROR =
  'Supabase isn\u2019t connected yet — cart actions will start working once it is.'

export async function isInCart(userId, designId) {
  if (!supabase || !userId) return { inCart: false, error: null }
  const { data, error } = await supabase
    .from('cart_items')
    .select('design_id')
    .eq('user_id', userId)
    .eq('design_id', designId)
    .maybeSingle()
  return { inCart: !!data, error: error?.message ?? null }
}

export async function addToCart(userId, designId) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase
    .from('cart_items')
    .upsert(
      { user_id: userId, design_id: designId },
      { onConflict: 'user_id,design_id', ignoreDuplicates: true },
    )
  return { error: error?.message ?? null }
}

export async function removeFromCart(userId, designId) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', userId)
    .eq('design_id', designId)
  return { error: error?.message ?? null }
}

export async function clearCart(userId) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase.from('cart_items').delete().eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function fetchCartCount(userId) {
  if (!supabase || !userId) return { count: 0, error: null }
  const { count, error } = await supabase
    .from('cart_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return { count: count ?? 0, error: error?.message ?? null }
}

/** Full design rows for the cart page. */
export async function fetchCartDesigns(userId) {
  if (!supabase) return { items: [], error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase
    .from('cart_items')
    .select(
      `
      created_at,
      design_id,
      designs (
        id,
        name,
        slug,
        price,
        thumbnail_url,
        file_format,
        design_id,
        is_active,
        design_file_url
      )
    `,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return { items: [], error: error.message }

  const items = (data ?? [])
    .map((row) => ({
      designId: row.design_id,
      addedAt: row.created_at,
      design: row.designs,
    }))
    .filter((row) => row.design)

  return { items, error: null }
}
