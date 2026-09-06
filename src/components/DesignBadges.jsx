/** Pin mark — top-right of catalogue cards when is_pinned. */
export function PinBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full
                  bg-white/95 text-maroon shadow-sm ring-1 ring-ink/8 ${className}`}
      title="Pinned"
      aria-label="Pinned design"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        {/* Classic thumbtack — readable at small sizes */}
        <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7h2.06v-7H19v-2c-1.66 0-3-1.34-3-3z" />
      </svg>
    </span>
  )
}

/** Best-seller label — top-left of catalogue cards. */
export function BestSellerBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-maroon px-2 py-1
                  text-[10px] font-semibold uppercase tracking-[0.12em] text-ivory
                  shadow-[0_1px_4px_rgba(45,32,24,0.18)] ${className}`}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2.5 14.6 9h6.2l-5 3.9 1.9 6.1L12 15.8 6.3 19l1.9-6.1-5-3.9h6.2L12 2.5z" />
      </svg>
      Best seller
    </span>
  )
}
