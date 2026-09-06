import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import Card from '../components/Card.jsx'
import WishlistButton from '../components/WishlistButton.jsx'
import Seo from '../components/Seo.jsx'
import Pagination from '../components/Pagination.jsx'
import { stripHtml } from '../lib/html.js'
import { DEFAULT_PAGE_SIZE } from '../lib/pagination.js'
import {
  fetchCategories,
  fetchDesigns,
  fetchSubcategories,
  FILE_FORMATS,
  fetchActiveDesignTypes,
  fetchActiveDesignAreas,
  fetchActiveDesignNeedles,
} from '../lib/catalog.js'

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-[12px] font-semibold leading-none transition-colors duration-150 ${
        active
          ? 'bg-maroon text-ivory'
          : 'bg-sand/70 text-ink-soft hover:bg-sand hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function FilterRow({ active, label, hint, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 ${
        active
          ? 'bg-maroon/8 text-maroon'
          : 'text-ink hover:bg-sand/60'
      }`}
    >
      <span
        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
          active ? 'border-maroon bg-maroon' : 'border-ink/25 bg-white'
        }`}
        aria-hidden
      >
        {active && <span className="h-1.5 w-1.5 rounded-full bg-ivory" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium leading-snug">{label}</span>
        {hint ? (
          <span className="mt-0.5 block truncate text-[11px] font-normal text-ink-soft">
            {hint}
          </span>
        ) : null}
      </span>
    </button>
  )
}

function FilterGroup({ title, children, dense = false }) {
  return (
    <div className="border-b border-ink/6 py-4 last:border-b-0 last:pb-0 first:pt-0">
      <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
        {title}
      </p>
      <div className={dense ? 'flex flex-wrap gap-1.5' : 'space-y-0.5'}>{children}</div>
    </div>
  )
}

/**
 * Two-column catalogue: filters | design grid.
 * Filter state lives in the URL for shareable views.
 */
export default function Designs() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const [categories, setCategories] = useState([])
  const [allSubcategories, setAllSubcategories] = useState([])
  const [designTypes, setDesignTypes] = useState([])
  const [areas, setAreas] = useState([])
  const [needles, setNeedles] = useState([])
  const [designs, setDesigns] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const categorySlug = params.get('category') || ''
  const subcategorySlug = params.get('subcategory') || ''
  const format = params.get('format') || ''
  const designTypeName = params.get('type') || ''
  const area = params.get('area') || ''
  const needle = params.get('needle') || ''
  const minPrice = params.get('min') || ''
  const maxPrice = params.get('max') || ''
  const query = params.get('q') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = Math.max(1, Number(params.get('pageSize')) || DEFAULT_PAGE_SIZE)

  const [searchInput, setSearchInput] = useState(query)
  const [minDraft, setMinDraft] = useState(minPrice)
  const [maxDraft, setMaxDraft] = useState(maxPrice)

  useEffect(() => {
    setSearchInput(query)
  }, [query])

  useEffect(() => {
    setMinDraft(minPrice)
    setMaxDraft(maxPrice)
  }, [minPrice, maxPrice])

  useEffect(() => {
    fetchCategories().then(({ categories: c }) => setCategories(c))
    fetchSubcategories().then(({ subcategories: s }) => setAllSubcategories(s))
    fetchActiveDesignTypes().then(({ designTypes: t }) => setDesignTypes(t))
    fetchActiveDesignAreas().then(({ areas: a }) => setAreas(a))
    fetchActiveDesignNeedles().then(({ needles: n }) => setNeedles(n))
  }, [])

  const categoryById = useMemo(() => {
    const map = new Map()
    categories.forEach((c) => map.set(c.id, c))
    return map
  }, [categories])

  const visibleSubcategories = useMemo(() => {
    if (!categorySlug) return allSubcategories
    return allSubcategories.filter((s) => {
      if (s.categories?.slug === categorySlug) return true
      const parent = categoryById.get(s.category_id)
      return parent?.slug === categorySlug
    })
  }, [allSubcategories, categorySlug, categoryById])

  useEffect(() => {
    setLoading(true)
    const designTypeId = designTypes.find((t) => t.name === designTypeName)?.id
    fetchDesigns({
      categorySlug: categorySlug || undefined,
      subcategorySlug: subcategorySlug || undefined,
      format: format || undefined,
      designTypeId: designTypeId || undefined,
      area: area || undefined,
      needle: needle || undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      query: query || undefined,
      page,
      pageSize,
    }).then(({ designs: d, total: t }) => {
      setDesigns(d)
      setTotal(t ?? 0)
      setLoading(false)
    })
  }, [
    categorySlug,
    subcategorySlug,
    format,
    designTypeName,
    area,
    needle,
    minPrice,
    maxPrice,
    query,
    page,
    pageSize,
    designTypes,
  ])

  const updateParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(params)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page' && key !== 'pageSize') next.delete('page')
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const setCategory = (slug) => {
    const next = new URLSearchParams(params)
    if (slug) next.set('category', slug)
    else next.delete('category')
    next.delete('subcategory')
    next.delete('page')
    setParams(next, { replace: true })
  }

  const setSubcategory = (slug) => {
    const next = new URLSearchParams(params)
    if (slug) {
      next.set('subcategory', slug)
      const sub = allSubcategories.find((s) => s.slug === slug)
      const parentSlug =
        sub?.categories?.slug || categoryById.get(sub?.category_id)?.slug
      if (parentSlug) next.set('category', parentSlug)
    } else {
      next.delete('subcategory')
    }
    next.delete('page')
    setParams(next, { replace: true })
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    updateParam('q', searchInput.trim())
  }

  const applyPrice = (e) => {
    e.preventDefault()
    const next = new URLSearchParams(params)
    if (minDraft) next.set('min', minDraft)
    else next.delete('min')
    if (maxDraft) next.set('max', maxDraft)
    else next.delete('max')
    next.delete('page')
    setParams(next, { replace: true })
  }

  const setPage = (nextPage) => {
    updateParam('page', nextPage > 1 ? String(nextPage) : '')
  }

  const setPageSize = (nextSize) => {
    const next = new URLSearchParams(params)
    if (nextSize === DEFAULT_PAGE_SIZE) next.delete('pageSize')
    else next.set('pageSize', String(nextSize))
    next.delete('page')
    setParams(next, { replace: true })
  }

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug),
    [categories, categorySlug],
  )

  const activeSubcategory = useMemo(
    () => allSubcategories.find((s) => s.slug === subcategorySlug),
    [allSubcategories, subcategorySlug],
  )

  const clearFilters = () => {
    setParams({}, { replace: true })
    setSearchInput('')
    setMinDraft('')
    setMaxDraft('')
  }

  const activeFilterCount = [
    categorySlug,
    subcategorySlug,
    format,
    designTypeName,
    area,
    needle,
    minPrice,
    maxPrice,
    query,
  ].filter(Boolean).length

  const heading = activeSubcategory?.name || activeCategory?.name || 'All designs'
  const seoDescription =
    activeSubcategory?.description ||
    activeCategory?.description ||
    'Search and filter the full embroidery design catalogue by category, type, area, needle, price and machine file format.'

  const subcategoryHint = (sub) => {
    if (categorySlug) return null
    return sub.categories?.name || categoryById.get(sub.category_id)?.name || null
  }

  const filterPanel = (
    <div className="overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-[0_1px_2px_rgba(45,32,24,0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-ink/6 bg-sand/35 px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Filters</h2>
          <p className="mt-0.5 text-[11px] text-ink-soft">
            {activeFilterCount > 0 ? `${activeFilterCount} active` : 'Refine the catalogue'}
          </p>
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md px-2 py-1 text-xs font-semibold text-maroon hover:bg-maroon/8"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="px-3.5 py-1 md:max-h-[calc(100vh-11rem)] md:overflow-y-auto">
        <FilterGroup title="Category">
          <FilterRow
            active={!categorySlug}
            label="All categories"
            onClick={() => setCategory('')}
          />
          {categories.map((c) => (
            <FilterRow
              key={c.id}
              active={categorySlug === c.slug}
              label={c.name}
              onClick={() => setCategory(c.slug)}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Subcategory">
          {visibleSubcategories.length === 0 ? (
            <p className="px-2.5 py-2 text-[12px] leading-relaxed text-ink-soft">
              {categorySlug
                ? 'No subcategories in this category yet.'
                : 'No subcategories yet.'}
            </p>
          ) : (
            <>
              <FilterRow
                active={!subcategorySlug}
                label="All subcategories"
                onClick={() => setSubcategory('')}
              />
              {visibleSubcategories.map((s) => (
                <FilterRow
                  key={s.id}
                  active={subcategorySlug === s.slug}
                  label={s.name}
                  hint={subcategoryHint(s)}
                  onClick={() => setSubcategory(s.slug)}
                />
              ))}
            </>
          )}
        </FilterGroup>

        {designTypes.length > 0 && (
          <FilterGroup title="Design type" dense>
            <Chip active={!designTypeName} onClick={() => updateParam('type', '')}>
              All
            </Chip>
            {designTypes.map((t) => (
              <Chip
                key={t.id}
                active={designTypeName === t.name}
                onClick={() => updateParam('type', t.name)}
              >
                {t.name}
              </Chip>
            ))}
          </FilterGroup>
        )}

        {areas.length > 0 && (
          <FilterGroup title="Area" dense>
            <Chip active={!area} onClick={() => updateParam('area', '')}>
              All
            </Chip>
            {areas.map((a) => (
              <Chip
                key={a.id}
                active={area === a.name}
                onClick={() => updateParam('area', a.name)}
              >
                {a.name}
              </Chip>
            ))}
          </FilterGroup>
        )}

        {needles.length > 0 && (
          <FilterGroup title="Needle" dense>
            <Chip active={!needle} onClick={() => updateParam('needle', '')}>
              All
            </Chip>
            {needles.map((n) => (
              <Chip
                key={n.id}
                active={needle === n.name}
                onClick={() => updateParam('needle', n.name)}
              >
                {n.name}
              </Chip>
            ))}
          </FilterGroup>
        )}

        <FilterGroup title="File format" dense>
          <Chip active={!format} onClick={() => updateParam('format', '')}>
            All
          </Chip>
          {FILE_FORMATS.map((f) => (
            <Chip
              key={f}
              active={format === f}
              onClick={() => updateParam('format', f)}
            >
              {f}
            </Chip>
          ))}
        </FilterGroup>

        <div className="py-4">
          <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Price (₹)
          </p>
          <form onSubmit={applyPrice} className="space-y-2 px-0.5">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={minDraft}
                onChange={(e) => setMinDraft(e.target.value)}
                placeholder="Min"
                aria-label="Minimum price"
                className="w-full rounded-lg border border-ink/10 bg-ivory/60 px-3 py-2 text-sm
                           placeholder:text-ink-soft/50
                           focus:border-maroon/40 focus:outline-none focus:ring-2 focus:ring-maroon/10"
              />
              <span className="shrink-0 text-ink-soft">–</span>
              <input
                type="number"
                min="0"
                value={maxDraft}
                onChange={(e) => setMaxDraft(e.target.value)}
                placeholder="Max"
                aria-label="Maximum price"
                className="w-full rounded-lg border border-ink/10 bg-ivory/60 px-3 py-2 text-sm
                           placeholder:text-ink-soft/50
                           focus:border-maroon/40 focus:outline-none focus:ring-2 focus:ring-maroon/10"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-ink py-2 text-xs font-semibold text-ivory transition-colors hover:bg-maroon"
            >
              Apply price
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Seo
        title={heading === 'All designs' ? 'All Designs' : heading}
        description={seoDescription}
      />

      <section className="bg-ivory px-6 pt-14 pb-8 md:pt-16 md:pb-10">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow text-gold-dark">
            {activeCategory || activeSubcategory ? 'Collection' : 'Catalogue'}
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl lg:text-5xl">{heading}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft md:text-base">
            {activeSubcategory?.description ||
              activeCategory?.description ||
              'Machine-ready embroidery designs — use filters to find the right file.'}
          </p>

          <form
            onSubmit={handleSearchSubmit}
            className="mt-7 flex max-w-xl overflow-hidden rounded-full border border-ink/10 bg-white shadow-sm"
          >
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, motif, or design ID…"
              aria-label="Search designs"
              className="min-w-0 flex-1 border-0 bg-transparent px-5 py-3 text-sm focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 bg-maroon px-5 py-3 text-sm font-semibold text-ivory hover:bg-maroon-light"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 md:grid-cols-[260px_1fr] md:gap-10 md:py-10 lg:grid-cols-[280px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start lg:top-28">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="mb-4 flex w-full items-center justify-between rounded-2xl border border-ink/10
                       bg-white px-4 py-3.5 text-sm font-semibold text-ink shadow-sm md:hidden"
            aria-expanded={filtersOpen}
          >
            <span className="inline-flex items-center gap-2">
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-maroon px-2 py-0.5 text-[11px] font-semibold text-ivory">
                  {activeFilterCount}
                </span>
              )}
            </span>
            <span className="text-xs font-medium text-ink-soft">
              {filtersOpen ? 'Hide' : 'Show'}
            </span>
          </button>

          <div className={`${filtersOpen ? 'block' : 'hidden'} md:block`}>{filterPanel}</div>
        </aside>

        <div>
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              {loading ? 'Loading…' : `${total} ${total === 1 ? 'design' : 'designs'}`}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-maroon underline-offset-2 hover:underline md:hidden"
              >
                Clear filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-sm bg-sand" />
              ))}
            </div>
          ) : total === 0 ? (
            <div className="rounded-2xl border border-ink/8 bg-white px-6 py-16 text-center shadow-sm">
              <p className="font-display text-xl text-ink">No designs found</p>
              <p className="mt-2 text-sm text-ink-soft">
                Try another filter or clear all.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="btn-primary mt-6 !px-5 !py-2.5"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {designs.map((d) => (
                  <Card
                    key={d.id}
                    to={`/designs/${d.slug}`}
                    image={d.thumbnail_url}
                    imageAlt={d.name}
                    eyebrow={
                      d.design_id ? `#${d.design_id} · ${d.file_format}` : d.file_format
                    }
                    title={d.name}
                    description={stripHtml(d.description)}
                    footer={<p className="font-semibold text-maroon">₹{d.price}</p>}
                    topRight={
                      <WishlistButton
                        designId={d.id}
                        variant="icon"
                        redirectPath={`${location.pathname}${location.search}`}
                      />
                    }
                  />
                ))}
              </div>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      </div>
    </>
  )
}
