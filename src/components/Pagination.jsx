import { PAGE_SIZE_OPTIONS, totalPages } from '../lib/pagination.js'
import { scrollPageToTop } from './ScrollToTop.jsx'

/**
 * Shared list pagination — admin tables, catalog grids, account lists.
 * Keep outside AdminTable so non-table surfaces can reuse the same control.
 */
export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  showPageSize = true,
  className = '',
}) {
  const safeTotal = Math.max(0, Number(total) || 0)
  if (safeTotal <= 0) return null

  const pageCount = totalPages(safeTotal, pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, safeTotal)

  const goToPage = (nextPage) => {
    onPageChange(nextPage)
    scrollPageToTop()
  }

  const changePageSize = (nextSize) => {
    onPageSizeChange?.(nextSize)
    scrollPageToTop()
  }

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 ${className}`}
      role="navigation"
      aria-label="Pagination"
    >
      <p className="text-sm text-ink-soft">
        Showing{' '}
        <span className="font-semibold text-ink tabular-nums">{from}</span>
        &ndash;
        <span className="font-semibold text-ink tabular-nums">{to}</span>
        {' '}of{' '}
        <span className="font-semibold text-ink tabular-nums">{safeTotal}</span>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {showPageSize && onPageSizeChange ? (
          <label className="inline-flex items-center gap-2 text-xs text-ink-soft">
            <span className="sr-only">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              className="appearance-none bg-white border border-ink/12 rounded-lg pl-3 pr-8 py-1.5
                         text-xs font-semibold text-ink cursor-pointer
                         focus:outline-none focus:border-maroon/35 focus:ring-2 focus:ring-maroon/10"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>/ page</span>
          </label>
        ) : null}

        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-ink/12 bg-white
                       text-ink hover:border-ink/25 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors duration-150"
          >
            Previous
          </button>
          <span className="px-2 text-xs text-ink-soft tabular-nums whitespace-nowrap">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => goToPage(page + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-ink/12 bg-white
                       text-ink hover:border-ink/25 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors duration-150"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
