import { useEffect, useId, useRef, useState } from 'react'
import { IconChevronDown, IconX } from './icons.jsx'

function formatDay(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateRange(from, to) {
  if (from && to) return `${formatDay(from)} – ${formatDay(to)}`
  if (from) return `From ${formatDay(from)}`
  if (to) return `Until ${formatDay(to)}`
  return ''
}

function RangeInputs({ title, fromId, toId, from, to, onFrom, onTo }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {title}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="min-w-0" htmlFor={fromId}>
          <span className="mb-1 block text-[11px] text-ink-soft">From</span>
          <input
            id={fromId}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onFrom(e.target.value)}
            className="admin-input !py-1.5 !text-xs"
          />
        </label>
        <span className="pb-2 text-ink-soft/50" aria-hidden>
          –
        </span>
        <label className="min-w-0" htmlFor={toId}>
          <span className="mb-1 block text-[11px] text-ink-soft">To</span>
          <input
            id={toId}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onTo(e.target.value)}
            className="admin-input !py-1.5 !text-xs"
          />
        </label>
      </div>
    </div>
  )
}

/**
 * Compact date-range filter for dense admin lists.
 * Trigger sits in the toolbar; panel overlays content (no table push-down).
 */
export default function DateRangeFilterPopover({
  createdFrom,
  createdTo,
  joinFrom,
  joinTo,
  onChange,
  onClear,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const uid = useId()

  const createdLabel = formatDateRange(createdFrom, createdTo)
  const joinLabel = formatDateRange(joinFrom, joinTo)
  const activeCount = (createdLabel ? 1 : 0) + (joinLabel ? 1 : 0)
  const hasDates = activeCount > 0

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const setField = (key) => (value) => {
    onChange({ [key]: value })
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-[38px] w-auto shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold
                    transition-colors ${
                      open || hasDates
                        ? 'border-maroon/30 bg-maroon/8 text-maroon'
                        : 'border-ink/10 bg-white text-ink-soft hover:border-ink/20 hover:text-ink'
                    }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" />
        </svg>
        <span>Date range</span>
        {hasDates ? (
          <span className="rounded-full bg-maroon px-1.5 py-0.5 text-[10px] leading-none text-ivory">
            {activeCount}
          </span>
        ) : null}
        <IconChevronDown
          className={`h-3.5 w-3.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filter by date range"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-2rem))]
                     overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-lg shadow-ink/10
                     sm:left-auto"
        >
          <div className="flex items-center justify-between border-b border-ink/6 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Filter by dates</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                Created and joining periods
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-ink-soft hover:bg-sand hover:text-ink"
              aria-label="Close date filters"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-4 py-4">
            <RangeInputs
              title="Created"
              fromId={`${uid}-created-from`}
              toId={`${uid}-created-to`}
              from={createdFrom}
              to={createdTo}
              onFrom={setField('createdFrom')}
              onTo={setField('createdTo')}
            />
            <div className="border-t border-ink/6 pt-4">
              <RangeInputs
                title="Join date"
                fromId={`${uid}-join-from`}
                toId={`${uid}-join-to`}
                from={joinFrom}
                to={joinTo}
                onFrom={setField('joinFrom')}
                onTo={setField('joinTo')}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-ink/6 bg-sand/30 px-4 py-3">
            <button
              type="button"
              onClick={onClear}
              disabled={!hasDates}
              className="text-xs font-semibold text-maroon hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
            >
              Clear dates
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-maroon px-3.5 py-2 text-xs font-semibold text-ivory hover:bg-maroon-light"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Slim removable chips for active date ranges (one line under the toolbar). */
export function DateRangeFilterChips({
  createdFrom,
  createdTo,
  joinFrom,
  joinTo,
  onChange,
}) {
  const createdLabel = formatDateRange(createdFrom, createdTo)
  const joinLabel = formatDateRange(joinFrom, joinTo)
  if (!createdLabel && !joinLabel) return null

  return (
    <div className="-mt-2 mb-4 flex flex-wrap items-center gap-1.5">
      {createdLabel ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-ink/8 bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm">
          <span className="text-ink-soft">Created</span> {createdLabel}
          <button
            type="button"
            aria-label="Clear created date filter"
            onClick={() => onChange({ createdFrom: '', createdTo: '' })}
            className="ml-0.5 rounded-full p-0.5 text-ink-soft hover:bg-sand hover:text-ink"
          >
            <IconX className="h-3 w-3" />
          </button>
        </span>
      ) : null}
      {joinLabel ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-ink/8 bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm">
          <span className="text-ink-soft">Join</span> {joinLabel}
          <button
            type="button"
            aria-label="Clear join date filter"
            onClick={() => onChange({ joinFrom: '', joinTo: '' })}
            className="ml-0.5 rounded-full p-0.5 text-ink-soft hover:bg-sand hover:text-ink"
          >
            <IconX className="h-3 w-3" />
          </button>
        </span>
      ) : null}
    </div>
  )
}
