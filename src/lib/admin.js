import { supabase } from './supabaseClient.js'
import {
  DEFAULT_PAGE_SIZE,
  pageRange,
  sanitizeSearchTerm,
} from './pagination.js'

const NOT_CONFIGURED_ERROR =
  'Supabase isn\u2019t connected yet — admin actions will start working once it is.'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date = new Date()) {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const next = new Date(date)
  next.setDate(date.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfRollingDays(days, date = new Date()) {
  const next = new Date(date)
  next.setDate(next.getDate() - (days - 1))
  next.setHours(0, 0, 0, 0)
  return next
}

function sumAmounts(rows) {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
}

function countSince(rows, startDate) {
  return rows.filter((row) => new Date(row.created_at) >= startDate).length
}

function buildRevenueStats(orderRows) {
  const now = new Date()
  const paid = orderRows.filter((row) => row.status === 'paid')
  const pending = orderRows.filter((row) => row.status === 'pending')
  const failed = orderRows.filter((row) => row.status === 'failed')

  const todayStart = startOfDay(now)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)
  const rolling7Start = startOfRollingDays(7, now)
  const rolling30Start = startOfRollingDays(30, now)
  const rolling90Start = startOfRollingDays(90, now)

  const paidToday = paid.filter((row) => new Date(row.created_at) >= todayStart)
  const paidThisWeek = paid.filter((row) => new Date(row.created_at) >= weekStart)
  const paidThisMonth = paid.filter((row) => new Date(row.created_at) >= monthStart)
  const paid7d = paid.filter((row) => new Date(row.created_at) >= rolling7Start)
  const paid30d = paid.filter((row) => new Date(row.created_at) >= rolling30Start)
  const paid90d = paid.filter((row) => new Date(row.created_at) >= rolling90Start)

  const paidRevenue = sumAmounts(paid)
  const pendingRevenue = sumAmounts(pending)

  return {
    todayRevenue: sumAmounts(paidToday),
    weekRevenue: sumAmounts(paidThisWeek),
    monthRevenue: sumAmounts(paidThisMonth),
    totalRevenue: paidRevenue,
    paidOrdersToday: paidToday.length,
    paidOrdersWeek: paidThisWeek.length,
    paidOrdersMonth: paidThisMonth.length,
    averageOrderValue: paid.length ? paidRevenue / paid.length : 0,
    pendingCount: pending.length,
    pendingRevenue,
    paidCount: paid.length,
    failedCount: failed.length,
    totalOrdersToday: countSince(orderRows, todayStart),
    revenueRanges: {
      '7d': {
        label: 'Last 7 days',
        revenue: sumAmounts(paid7d),
        orders: paid7d.length,
      },
      '30d': {
        label: 'Last 30 days',
        revenue: sumAmounts(paid30d),
        orders: paid30d.length,
      },
      '90d': {
        label: 'Last 90 days',
        revenue: sumAmounts(paid90d),
        orders: paid90d.length,
      },
      month: {
        label: 'This month',
        revenue: sumAmounts(paidThisMonth),
        orders: paidThisMonth.length,
      },
      all: {
        label: 'All time',
        revenue: paidRevenue,
        orders: paid.length,
      },
    },
  }
}

/**
 * Unlike catalog.js and wishlist.js, there's no mock-data fallback here.
 * /admin is only reachable with a real session AND role='admin' (see
 * AdminRoute), so there's no way to exercise these functions without
 * Supabase connected in the first place — a fallback would be dead code.
 */

// ---------- Dashboard ----------

export async function fetchDashboardStats() {
  if (!supabase) return { stats: null, error: NOT_CONFIGURED_ERROR }
  const [designs, categories, users, ordersCount, ordersData] = await Promise.all([
    supabase.from('designs').select('*', { count: 'exact', head: true }),
    supabase.from('categories').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('amount, status, created_at'),
  ])
  const firstError = [designs, categories, users, ordersCount, ordersData].find((r) => r.error)?.error
  if (firstError) return { stats: null, error: firstError.message }

  const revenue = buildRevenueStats(ordersData.data ?? [])

  return {
    stats: {
      designs: designs.count ?? 0,
      categories: categories.count ?? 0,
      users: users.count ?? 0,
      orders: ordersCount.count ?? 0,
      ...revenue,
    },
    error: null,
  }
}

export async function fetchOrdersAdmin({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  query = '',
  status = 'all',
} = {}) {
  if (!supabase) return { orders: [], total: 0, error: NOT_CONFIGURED_ERROR }

  let q = supabase
    .from('orders')
    .select(
      `
      id,
      amount,
      status,
      created_at,
      razorpay_order_id,
      profiles:user_id (
        full_name,
        phone,
        email
      ),
      designs:design_id (
        id,
        name,
        slug
      )
    `,
      { count: 'exact' },
    )

  if (status !== 'all') q = q.eq('status', status)

  const safe = sanitizeSearchTerm(query)
  if (safe) {
    const orParts = [`razorpay_order_id.ilike.%${safe}%`]
    if (UUID_RE.test(safe)) orParts.push(`id.eq.${safe}`)

    const [{ data: profiles }, { data: designs }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id')
        .or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`)
        .limit(100),
      supabase
        .from('designs')
        .select('id')
        .or(`name.ilike.%${safe}%,slug.ilike.%${safe}%`)
        .limit(100),
    ])

    const userIds = (profiles ?? []).map((row) => row.id)
    const designIds = (designs ?? []).map((row) => row.id)
    if (userIds.length) orParts.push(`user_id.in.(${userIds.join(',')})`)
    if (designIds.length) orParts.push(`design_id.in.(${designIds.join(',')})`)
    q = q.or(orParts.join(','))
  }

  const { from, to } = pageRange(page, pageSize)
  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return { orders: [], total: 0, error: error.message }
  return { orders: data ?? [], total: count ?? 0, error: null }
}

// ---------- Categories ----------

export async function fetchAllCategories() {
  if (!supabase) return { categories: [], error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('categories').select('*').order('sort_order')
  if (error) return { categories: [], error: error.message }
  return { categories: data, error: null }
}

export async function createCategory(payload) {
  if (!supabase) return { category: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('categories').insert(payload).select().single()
  return { category: data ?? null, error: error?.message ?? null }
}

export async function updateCategory(id, payload) {
  if (!supabase) return { category: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('categories').update(payload).eq('id', id).select().single()
  return { category: data ?? null, error: error?.message ?? null }
}

export async function deleteCategory(id) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase.from('categories').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ---------- Subcategories ----------

export async function fetchAllSubcategories() {
  if (!supabase) return { subcategories: [], error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase
    .from('subcategories')
    .select('*, categories(id, name, slug)')
    .order('sort_order', { ascending: true })
  if (error) return { subcategories: [], error: error.message }
  return { subcategories: data ?? [], error: null }
}

export async function createSubcategory(payload) {
  if (!supabase) return { subcategory: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('subcategories').insert(payload).select().single()
  return { subcategory: data ?? null, error: error?.message ?? null }
}

export async function updateSubcategory(id, payload) {
  if (!supabase) return { subcategory: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('subcategories').update(payload).eq('id', id).select().single()
  return { subcategory: data ?? null, error: error?.message ?? null }
}

export async function deleteSubcategory(id) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase.from('subcategories').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ---------- Design types ----------

export async function fetchAllDesignTypes() {
  if (!supabase) return { designTypes: [], error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase
    .from('design_types')
    .select('*')
    .order('name', { ascending: true })
  if (error) return { designTypes: [], error: error.message }
  return { designTypes: data ?? [], error: null }
}

export async function createDesignType(payload) {
  if (!supabase) return { designType: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('design_types').insert(payload).select().single()
  return { designType: data ?? null, error: error?.message ?? null }
}

export async function updateDesignType(id, payload) {
  if (!supabase) return { designType: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('design_types').update(payload).eq('id', id).select().single()
  return { designType: data ?? null, error: error?.message ?? null }
}

export async function deleteDesignType(id) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase.from('design_types').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ---------- Design areas ----------

export async function fetchAllDesignAreas() {
  if (!supabase) return { areas: [], error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase
    .from('design_areas')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) return { areas: [], error: error.message }
  return { areas: data ?? [], error: null }
}

export async function createDesignArea(payload) {
  if (!supabase) return { area: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('design_areas').insert(payload).select().single()
  return { area: data ?? null, error: error?.message ?? null }
}

export async function updateDesignArea(id, payload) {
  if (!supabase) return { area: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('design_areas').update(payload).eq('id', id).select().single()
  return { area: data ?? null, error: error?.message ?? null }
}

export async function deleteDesignArea(id) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase.from('design_areas').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ---------- Design needles ----------

export async function fetchAllDesignNeedles() {
  if (!supabase) return { needles: [], error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase
    .from('design_needles')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) return { needles: [], error: error.message }
  return { needles: data ?? [], error: null }
}

export async function createDesignNeedle(payload) {
  if (!supabase) return { needle: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('design_needles').insert(payload).select().single()
  return { needle: data ?? null, error: error?.message ?? null }
}

export async function updateDesignNeedle(id, payload) {
  if (!supabase) return { needle: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('design_needles').update(payload).eq('id', id).select().single()
  return { needle: data ?? null, error: error?.message ?? null }
}

export async function deleteDesignNeedle(id) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase.from('design_needles').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ---------- Carousel slides ----------

export async function fetchAllCarouselSlides() {
  if (!supabase) return { slides: [], error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase
    .from('carousel_slides')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) return { slides: [], error: error.message }
  return { slides: data ?? [], error: null }
}

export async function createCarouselSlide(payload) {
  if (!supabase) return { slide: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('carousel_slides').insert(payload).select().single()
  return { slide: data ?? null, error: error?.message ?? null }
}

export async function updateCarouselSlide(id, payload) {
  if (!supabase) return { slide: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('carousel_slides').update(payload).eq('id', id).select().single()
  return { slide: data ?? null, error: error?.message ?? null }
}

export async function deleteCarouselSlide(id) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase.from('carousel_slides').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ---------- Offers ----------

export async function fetchAllOffers() {
  if (!supabase) return { offers: [], error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return { offers: [], error: error.message }
  return { offers: data ?? [], error: null }
}

export async function createOffer(payload) {
  if (!supabase) return { offer: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('offers').insert(payload).select().single()
  return { offer: data ?? null, error: error?.message ?? null }
}

export async function updateOffer(id, payload) {
  if (!supabase) return { offer: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.from('offers').update(payload).eq('id', id).select().single()
  return { offer: data ?? null, error: error?.message ?? null }
}

export async function deleteOffer(id) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase.from('offers').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ---------- Products (designs) ----------

/**
 * Admin sees every design regardless of `is_active`, unlike the public
 * catalog (`fetchDesigns` in catalog.js), which filters to active-only.
 */
export async function fetchAllDesigns({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  query = '',
  status = 'all',
} = {}) {
  if (!supabase) return { designs: [], total: 0, error: NOT_CONFIGURED_ERROR }

  let q = supabase
    .from('designs')
    .select(
      '*, categories(name), subcategories(name, slug, category_id), design_types(id, name, is_active), design_areas(id, name, is_active), design_needles(id, name, is_active)',
      { count: 'exact' },
    )

  if (status === 'active') q = q.eq('is_active', true)
  if (status === 'draft') q = q.eq('is_active', false)

  const safe = sanitizeSearchTerm(query)
  if (safe) {
    q = q.or(
      `name.ilike.%${safe}%,design_id.ilike.%${safe}%,slug.ilike.%${safe}%`,
    )
  }

  const { from, to } = pageRange(page, pageSize)
  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return { designs: [], total: 0, error: error.message }
  return { designs: data ?? [], total: count ?? 0, error: null }
}

export async function createDesign(payload) {
  if (!supabase) return { design: null, error: NOT_CONFIGURED_ERROR }
  // design_id is assigned by a DB trigger — never send it from the client
  const { design_id: _omit, ...safe } = payload
  const { data, error } = await supabase.from('designs').insert(safe).select().single()
  return { design: data ?? null, error: error?.message ?? null }
}

export async function updateDesign(id, payload) {
  if (!supabase) return { design: null, error: NOT_CONFIGURED_ERROR }
  // design_id is immutable; strip it so updates cannot attempt a change
  const { design_id: _omit, ...safe } = payload
  const { data, error } = await supabase.from('designs').update(safe).eq('id', id).select().single()
  return { design: data ?? null, error: error?.message ?? null }
}

export async function deleteDesign(id) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase.from('designs').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function uploadProductImage(file) {
  if (!supabase) return { url: null, error: NOT_CONFIGURED_ERROR }
  const path = `${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('product-images').upload(path, file)
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

/**
 * `design-files` is a private bucket, so upload only returns a storage
 * path, not a public URL — there's no customer-download flow yet (that
 * depends on checkout, which is still a Buy Now stub), so signed-URL
 * generation on demand is a follow-up rather than something to build
 * speculatively here.
 */
export async function uploadDesignFile(file) {
  if (!supabase) return { path: null, error: NOT_CONFIGURED_ERROR }
  const path = `${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('design-files').upload(path, file)
  if (error) return { path: null, error: error.message }
  return { path, error: null }
}

// ---------- Admissions ----------

export async function fetchAdmissionStatusCounts() {
  if (!supabase) {
    return {
      counts: { all: 0, pending: 0, reviewed: 0, enrolled: 0, rejected: 0 },
      error: NOT_CONFIGURED_ERROR,
    }
  }

  const statuses = ['pending', 'reviewed', 'enrolled', 'rejected']
  const [allRes, ...statusRes] = await Promise.all([
    supabase.from('admissions').select('*', { count: 'exact', head: true }),
    ...statuses.map((status) =>
      supabase
        .from('admissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', status),
    ),
  ])

  const firstError = [allRes, ...statusRes].find((row) => row.error)?.error
  if (firstError) {
    return {
      counts: { all: 0, pending: 0, reviewed: 0, enrolled: 0, rejected: 0 },
      error: firstError.message,
    }
  }

  const counts = { all: allRes.count ?? 0 }
  statuses.forEach((status, index) => {
    counts[status] = statusRes[index].count ?? 0
  })
  return { counts, error: null }
}

export async function fetchAllAdmissions({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  query = '',
  status = 'all',
} = {}) {
  if (!supabase) return { admissions: [], total: 0, error: NOT_CONFIGURED_ERROR }

  let q = supabase.from('admissions').select('*', { count: 'exact' })
  if (status !== 'all') q = q.eq('status', status)

  const safe = sanitizeSearchTerm(query)
  if (safe) {
    const orParts = [
      `student_name.ilike.%${safe}%`,
      `student_mobile.ilike.%${safe}%`,
      `current_address.ilike.%${safe}%`,
      `reference_details.ilike.%${safe}%`,
    ]
    if (/^\d+$/.test(safe)) orParts.push(`form_number.eq.${Number(safe)}`)
    q = q.or(orParts.join(','))
  }

  const { from, to } = pageRange(page, pageSize)
  const { data, error, count } = await q
    .order('submitted_at', { ascending: false })
    .range(from, to)

  if (error) return { admissions: [], total: 0, error: error.message }
  return { admissions: data ?? [], total: count ?? 0, error: null }
}

export async function fetchAdmissionById(id) {
  if (!supabase) return { admission: null, installments: [], error: NOT_CONFIGURED_ERROR }
  const { data: admission, error: admErr } = await supabase
    .from('admissions')
    .select('*')
    .eq('id', id)
    .single()
  if (admErr) return { admission: null, installments: [], error: admErr.message }
  const { data: installments, error: instErr } = await supabase
    .from('admission_fee_installments')
    .select('*')
    .eq('admission_id', id)
    .order('sort_order', { ascending: true })
  if (instErr) return { admission: null, installments: [], error: instErr.message }
  return { admission, installments: installments ?? [], error: null }
}

export async function updateAdmission(id, payload) {
  if (!supabase) return { admission: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase
    .from('admissions')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { admission: data ?? null, error: error?.message ?? null }
}

export async function deleteAdmission(id) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }

  const { data: row, error: fetchErr } = await supabase
    .from('admissions')
    .select('student_photo_url, student_signature_url, aadhaar_card_urls')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }

  const paths = [
    row?.student_photo_url,
    row?.student_signature_url,
    ...(row?.aadhaar_card_urls ?? []),
  ].filter(Boolean)

  const { error } = await supabase.from('admissions').delete().eq('id', id)
  if (error) return { error: error.message }

  if (paths.length) await removeAdmissionAssets(paths)
  return { error: null }
}

export async function createAdmissionInstallment(admissionId, payload) {
  if (!supabase) return { installment: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase
    .from('admission_fee_installments')
    .insert({ ...payload, admission_id: admissionId })
    .select()
    .single()
  return { installment: data ?? null, error: error?.message ?? null }
}

export async function updateAdmissionInstallment(id, payload) {
  if (!supabase) return { installment: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase
    .from('admission_fee_installments')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { installment: data ?? null, error: error?.message ?? null }
}

export async function deleteAdmissionInstallment(id) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  const { error } = await supabase.from('admission_fee_installments').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function getAdmissionAssetSignedUrl(path, expiresIn = 3600) {
  if (!supabase || !path) return { url: null, error: NOT_CONFIGURED_ERROR }
  const { data, error } = await supabase.storage
    .from('admission-photos')
    .createSignedUrl(path, expiresIn)
  if (error) return { url: null, error: error.message }
  return { url: data?.signedUrl ?? null, error: null }
}

export async function getAdmissionAssetSignedUrls(paths = [], expiresIn = 3600) {
  if (!supabase) return { urls: [], error: NOT_CONFIGURED_ERROR }
  if (!Array.isArray(paths) || paths.length === 0) return { urls: [], error: null }

  const results = await Promise.all(paths.map((path) => getAdmissionAssetSignedUrl(path, expiresIn)))
  const firstError = results.find((row) => row.error)?.error
  if (firstError) return { urls: [], error: firstError }
  return { urls: results.map((row) => row.url).filter(Boolean), error: null }
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  try {
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: match[1].toLowerCase() })
  } catch {
    return null
  }
}

async function uploadAdmissionAsset(path, blob) {
  const { error } = await supabase.storage
    .from('admission-photos')
    .upload(path, blob, { contentType: blob.type, upsert: false })
  return { error: error?.message ?? null }
}

async function removeAdmissionAssets(paths) {
  const valid = (paths ?? []).filter(Boolean)
  if (valid.length === 0) return
  await supabase.storage.from('admission-photos').remove(valid)
}

/** Admin-only: create admission with photo/signature uploads and form number. */
export async function createAdmission(payload) {
  if (!supabase) return { admission: null, error: NOT_CONFIGURED_ERROR }

  const { data: formNumberRaw, error: seqErr } = await supabase.rpc('next_admission_form_number')
  if (seqErr || formNumberRaw == null) {
    return { admission: null, error: seqErr?.message ?? 'Could not assign form number' }
  }

  const photoBlob = dataUrlToBlob(payload.student_photo)
  if (!photoBlob) return { admission: null, error: 'Invalid photo upload' }

  const sigBlob = dataUrlToBlob(payload.student_signature)
  if (!sigBlob) return { admission: null, error: 'Invalid signature' }

  const aadhaarBlobs = (payload.aadhaar_cards ?? []).map((row) => dataUrlToBlob(row)).filter(Boolean)
  if (aadhaarBlobs.length !== (payload.aadhaar_cards ?? []).length) {
    return { admission: null, error: 'Invalid Aadhaar image upload' }
  }
  if (aadhaarBlobs.length > 2) {
    return { admission: null, error: 'You can upload up to 2 Aadhaar images only' }
  }

  const admissionId = crypto.randomUUID()
  const photoExt = photoBlob.type.includes('png') ? 'png' : 'jpg'
  const photoPath = `photos/${admissionId}.${photoExt}`
  const sigPath = `signatures/${admissionId}.png`
  const aadhaarPaths = aadhaarBlobs.map((blob, index) => {
    const ext = blob.type.includes('png') ? 'png' : 'jpg'
    return `aadhaar/${admissionId}-${index + 1}.${ext}`
  })
  const uploadedPaths = []

  const { error: photoErr } = await uploadAdmissionAsset(photoPath, photoBlob)
  if (photoErr) return { admission: null, error: photoErr }
  uploadedPaths.push(photoPath)

  const { error: sigErr } = await uploadAdmissionAsset(sigPath, sigBlob)
  if (sigErr) {
    await removeAdmissionAssets(uploadedPaths)
    return { admission: null, error: sigErr }
  }
  uploadedPaths.push(sigPath)

  for (let i = 0; i < aadhaarBlobs.length; i++) {
    const { error: aadhaarErr } = await uploadAdmissionAsset(aadhaarPaths[i], aadhaarBlobs[i])
    if (aadhaarErr) {
      await removeAdmissionAssets(uploadedPaths)
      return { admission: null, error: aadhaarErr }
    }
    uploadedPaths.push(aadhaarPaths[i])
  }

  const now = new Date().toISOString()
  const row = {
    id: admissionId,
    form_number: Number(formNumberRaw),
    student_name: payload.student_name,
    student_mobile: payload.student_mobile,
    father_mobile: payload.father_mobile || null,
    student_photo_url: photoPath,
    aadhaar_card_urls: aadhaarPaths,
    student_signature_url: sigPath,
    current_address: payload.current_address,
    permanent_address: payload.permanent_address,
    reference_details: payload.reference_details || null,
    class_start_time: payload.class_start_time,
    class_end_time: payload.class_end_time,
    batch_type: payload.batch_type || null,
    package: payload.package || null,
    preferred_language: payload.preferred_language,
    agreed_to_terms: true,
    agreed_at: now,
    status: 'pending',
    submitted_at: now,
  }

  const { data, error } = await supabase.from('admissions').insert(row).select().single()
  if (error) {
    await removeAdmissionAssets(uploadedPaths)
    return { admission: null, error: error.message }
  }
  return { admission: data, error: null }
}

// ---------- Users ----------

export async function fetchUsers({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  query = '',
  role = 'all',
} = {}) {
  if (!supabase) return { users: [], total: 0, error: NOT_CONFIGURED_ERROR }

  let q = supabase.from('profiles').select('*', { count: 'exact' })
  if (role !== 'all') q = q.eq('role', role)

  const safe = sanitizeSearchTerm(query)
  if (safe) {
    q = q.or(
      `full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`,
    )
  }

  const { from, to } = pageRange(page, pageSize)
  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return { users: [], total: 0, error: error.message }
  return { users: data ?? [], total: count ?? 0, error: null }
}

export async function updateUserRole(userId, role) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  if (!['customer', 'admin', 'staff'].includes(role)) {
    return { error: 'Invalid role' }
  }
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  return { error: error?.message ?? null }
}

export async function creditUserWallet(targetUserId, amount, note, accessToken) {
  if (!supabase) return { error: NOT_CONFIGURED_ERROR }
  try {
    const { callEdgeFunction } = await import('./razorpay.js')
    const data = await callEdgeFunction(
      'admin-credit-wallet',
      {
        target_user_id: targetUserId,
        amount: Number(amount),
        note: note || null,
      },
      accessToken,
    )
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to credit wallet' }
  }
}
