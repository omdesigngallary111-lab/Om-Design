import { supabase } from './supabaseClient.js'
import { mockCategories, mockDesigns, mockSubcategories } from '../data/mockCatalog.js'
import {
  DEFAULT_PAGE_SIZE,
  pageRange,
  sanitizeSearchTerm,
} from './pagination.js'

/**
 * Every function here checks `supabase` first and runs the real query
 * shape you'd want against your schema; when it's null (no env vars
 * yet) it falls back to the mock catalog so Phase 3 pages are fully
 * browsable today. Swapping in real credentials requires no page
 * changes — only this file's fallback branches become dead code.
 */

export async function fetchCategories() {
  if (supabase) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) return { categories: [], error: error.message }
    return { categories: data, error: null }
  }
  return { categories: [...mockCategories].sort((a, b) => a.sort_order - b.sort_order), error: null }
}

export async function fetchCategoryBySlug(slug) {
  if (supabase) {
    const { data, error } = await supabase.from('categories').select('*').eq('slug', slug).single()
    if (error) return { category: null, error: error.message }
    return { category: data, error: null }
  }
  return { category: mockCategories.find((c) => c.slug === slug) ?? null, error: null }
}

export async function fetchSubcategories(categorySlug) {
  if (supabase) {
    let q = supabase
      .from('subcategories')
      .select('*, categories!inner(id, slug, name)')
      .order('sort_order', { ascending: true })
    if (categorySlug) q = q.eq('categories.slug', categorySlug)
    const { data, error } = await q
    if (error) return { subcategories: [], error: error.message }
    return { subcategories: data ?? [], error: null }
  }

  let rows = [...mockSubcategories]
  if (categorySlug) {
    const cat = mockCategories.find((c) => c.slug === categorySlug)
    rows = cat ? rows.filter((s) => s.category_id === cat.id) : []
  }
  return {
    subcategories: rows.sort((a, b) => a.sort_order - b.sort_order),
    error: null,
  }
}

/**
 * filters: {
 *   categorySlug, subcategorySlug, format, minPrice, maxPrice, query,
 *   designTypeId, area, needle,
 *   page, pageSize  — pagination (defaults: page 1, size 10)
 * }
 * All optional. `query` matches name and the 6-digit design_id.
 * `area` / `needle` match the stored text values (synced from option names).
 */
export async function fetchDesigns(filters = {}) {
  const {
    categorySlug,
    subcategorySlug,
    format,
    minPrice,
    maxPrice,
    query,
    designTypeId,
    area,
    needle,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = filters

  if (supabase) {
    const selectBase =
      '*, categories(slug, name), subcategories(slug, name), design_types(name)'
    let q = supabase
      .from('designs')
      .select(selectBase, { count: 'exact' })
      .eq('is_active', true)

    if (subcategorySlug) {
      q = supabase
        .from('designs')
        .select(
          '*, categories(slug, name), subcategories!inner(slug, name), design_types(name)',
          { count: 'exact' },
        )
        .eq('is_active', true)
        .eq('subcategories.slug', subcategorySlug)
    } else if (categorySlug) {
      q = supabase
        .from('designs')
        .select(
          '*, categories!inner(slug, name), subcategories(slug, name), design_types(name)',
          { count: 'exact' },
        )
        .eq('is_active', true)
        .eq('categories.slug', categorySlug)
    }

    if (format) q = q.eq('file_format', format)
    if (designTypeId) q = q.eq('design_type_id', designTypeId)
    if (area) q = q.eq('area', area)
    if (needle) q = q.eq('needle', needle)
    if (minPrice != null) q = q.gte('price', minPrice)
    if (maxPrice != null) q = q.lte('price', maxPrice)
    const safe = sanitizeSearchTerm(query)
    if (safe) {
      q = q.or(`name.ilike.%${safe}%,design_id.ilike.%${safe}%`)
    }

    const { from, to } = pageRange(page, pageSize)
    const { data, error, count } = await q
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) return { designs: [], total: 0, error: error.message }
    return { designs: data ?? [], total: count ?? 0, error: null }
  }

  let results = mockDesigns.filter((d) => d.is_active)
  if (subcategorySlug) results = results.filter((d) => d.subcategory_slug === subcategorySlug)
  else if (categorySlug) results = results.filter((d) => d.category_slug === categorySlug)
  if (format) results = results.filter((d) => d.file_format === format)
  if (designTypeId) results = results.filter((d) => d.design_type_id === designTypeId)
  if (area) results = results.filter((d) => d.area === area)
  if (needle) results = results.filter((d) => d.needle === needle)
  if (minPrice != null) results = results.filter((d) => d.price >= minPrice)
  if (maxPrice != null) results = results.filter((d) => d.price <= maxPrice)
  if (query) {
    const q = query.toLowerCase().trim()
    results = results.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        String(d.design_id ?? '').includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.tags?.some((t) => t.toLowerCase().includes(q)),
    )
  }
  results = [...results].reverse()
  const total = results.length
  const { from, to } = pageRange(page, pageSize)
  return { designs: results.slice(from, to + 1), total, error: null }
}

/** Active design types for storefront filters. */
export async function fetchActiveDesignTypes() {
  if (supabase) {
    const { data, error } = await supabase
      .from('design_types')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (error) return { designTypes: [], error: error.message }
    return { designTypes: data ?? [], error: null }
  }
  return { designTypes: [], error: null }
}

/** Active area options for storefront filters. */
export async function fetchActiveDesignAreas() {
  if (supabase) {
    const { data, error } = await supabase
      .from('design_areas')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) return { areas: [], error: error.message }
    return { areas: data ?? [], error: null }
  }
  return { areas: [], error: null }
}

/** Active needle options for storefront filters. */
export async function fetchActiveDesignNeedles() {
  if (supabase) {
    const { data, error } = await supabase
      .from('design_needles')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (error) return { needles: [], error: error.message }
    return { needles: data ?? [], error: null }
  }
  return { needles: [], error: null }
}

export async function fetchDesignBySlug(slug) {
  if (supabase) {
    const { data, error } = await supabase
      .from('designs')
      .select('*, categories(name, slug), subcategories(name, slug, category_id), design_types(name)')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()
    if (error) return { design: null, error: error.message }
    return { design: data, error: null }
  }
  const raw = mockDesigns.find((d) => d.slug === slug && d.is_active) ?? null
  if (!raw) return { design: null, error: null }
  const cat = mockCategories.find((c) => c.id === raw.category_id)
  const sub = mockSubcategories.find((s) => s.id === raw.subcategory_id)
  return {
    design: {
      ...raw,
      categories: cat ? { name: cat.name, slug: cat.slug } : null,
      subcategories: sub ? { name: sub.name, slug: sub.slug, category_id: sub.category_id } : null,
      design_types: raw.design_type_name ? { name: raw.design_type_name } : null,
    },
    error: null,
  }
}

export async function fetchActiveCarouselSlides() {
  if (supabase) {
    const { data, error } = await supabase
      .from('carousel_slides')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (error) return { slides: [], error: error.message }
    return { slides: data ?? [], error: null }
  }
  return { slides: [], error: null }
}

// Kept in one place so Categories/Designs filter UI and any admin form
// (Phase 5) reference the same list rather than duplicating it.
// ZIP = multi-file package (several machine formats in one download).
export const FILE_FORMATS = ['DST', 'EMB', 'DHE', 'DHP', 'ZIP']

/** Extensions accepted for the private design-file upload. */
export const DESIGN_FILE_ACCEPT =
  '.dst,.emb,.dhe,.dhp,.zip,application/zip,application/x-zip-compressed'
