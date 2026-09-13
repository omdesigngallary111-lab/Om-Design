import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
    <div className="min-w-0">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {title}
      </p>
      {/* Stack on mobile — native date inputs are too wide to sit side-by-side */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end sm:gap-2">
        <label className="block min-w-0" htmlFor={fromId}>
          <span className="mb-1 block text-[11px] text-ink-soft">From</span>
          <input
            id={fromId}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onFrom(e.target.value)}
            className="admin-input !w-full min-w-0 !max-w-full !py-2 !text-sm sm:!py-1.5 sm:!text-xs"
          />
        </label>
        <span
          className="hidden pb-2 text-ink-soft/50 sm:block"
          aria-hidden
        >
          –
        </span>
        <label className="block min-w-0" htmlFor={toId}>
          <span className="mb-1 block text-[11px] text-ink-soft">To</span>
          <input
            id={toId}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onTo(e.target.value)}
            className="admin-input !w-full min-w-0 !max-w-full !py-2 !text-sm sm:!py-1.5 sm:!text-xs"
          />
        </label>
      </div>
    </div>
  )
}

function Panel({
  uid,
  createdFrom,
  createdTo,
  joinFrom,
  joinTo,
  hasDates,
  onClear,
  onClose,
  setField,
  panelRef,
  className,
}) {
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Filter by date range"
      className={className}
    >
      <div className="flex items-center justify-between border-b border-ink/6 px-4 py-3">
        <div className="min-w-0 pr-2">
          <p className="text-sm font-semibold text-ink">Filter by dates</p>
          <p className="mt-0.5 text-[11px] text-ink-soft">
            Created and joining periods
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-ink-soft hover:bg-sand hover:text-ink"
          aria-label="Close date filters"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[min(60vh,24rem)] space-y-4 overflow-y-auto px-4 py-4 sm:max-h-none sm:overflow-visible">
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
          onClick={onClose}
          className="rounded-lg bg-maroon px-3.5 py-2 text-xs font-semibold text-ivory hover:bg-maroon-light"
        >
          Done
        </button>
      </div>
    </div>
  )
}

/**
 * Compact date-range filter for dense admin lists.
 * Desktop: anchored popover. Mobile: full-width bottom sheet (no field overlap).
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
  const [isMobile, setIsMobile] = useState(false)
  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const uid = useId()

  const createdLabel = formatDateRange(createdFrom, createdTo)
  const joinLabel = formatDateRange(joinFrom, joinTo)
  const activeCount = (createdLabel ? 1 : 0) + (joinLabel ? 1 : 0)
  const hasDates = activeCount > 0

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      const target = event.target
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
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

  useEffect(() => {
    if (!open || !isMobile) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, isMobile])

  const setField = (key) => (value) => {
    onChange({ [key]: value })
  }

  const close = () => setOpen(false)

  const panelProps = {
    uid,
    createdFrom,
    createdTo,
    joinFrom,
    joinTo,
    hasDates,
    onClear,
    onClose: close,
    setField,
    panelRef,
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

      {open && !isMobile ? (
        <Panel
          {...panelProps}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[22rem] max-w-[calc(100vw-2rem)]
                     overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-lg shadow-ink/10"
        />
      ) : null}

      {open && isMobile && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex flex-col justify-end sm:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-ink/40"
                aria-label="Close date filters"
                onClick={close}
              />
              <Panel
                {...panelProps}
                className="relative z-[81] mx-3 mb-3 max-h-[min(88vh,36rem)] overflow-hidden
                           rounded-2xl border border-ink/10 bg-white shadow-xl shadow-ink/20"
              />
            </div>,
            document.body,
          )
        : null}
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
        <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-ink/8 bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm">
          <span className="shrink-0 text-ink-soft">Created</span>
          <span className="min-w-0 truncate">{createdLabel}</span>
          <button
            type="button"
            aria-label="Clear created date filter"
            onClick={() => onChange({ createdFrom: '', createdTo: '' })}
            className="ml-0.5 shrink-0 rounded-full p-0.5 text-ink-soft hover:bg-sand hover:text-ink"
          >
            <IconX className="h-3 w-3" />
          </button>
        </span>
      ) : null}
      {joinLabel ? (
        <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-ink/8 bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm">
          <span className="shrink-0 text-ink-soft">Join</span>
          <span className="min-w-0 truncate">{joinLabel}</span>
          <button
            type="button"
            aria-label="Clear join date filter"
            onClick={() => onChange({ joinFrom: '', joinTo: '' })}
            className="ml-0.5 shrink-0 rounded-full p-0.5 text-ink-soft hover:bg-sand hover:text-ink"
          >
            <IconX className="h-3 w-3" />
          </button>
        </span>
      ) : null}
    </div>
  )
}
