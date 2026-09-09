import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { STUDIO } from '../data/studio.js'

/** Hide on and after this local calendar date (DD-MM-YYYY → 10 Oct 2026). */
const PROMO_HIDE_ON = '2026-10-10'
const PROMO_CODE = 'WELCOME20'
const PROMO_PERCENT = 20

function isPromoVisible(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}` < PROMO_HIDE_ON
}

function JaalMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" aria-hidden>
      <circle cx="100" cy="100" r="78" stroke="currentColor" strokeWidth="0.6" />
      <circle cx="100" cy="100" r="58" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="38" stroke="currentColor" strokeWidth="0.5" />
      <path
        d="M100 22 L100 178 M22 100 L178 100 M42 42 L158 158 M158 42 L42 158"
        stroke="currentColor"
        strokeWidth="0.45"
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const r = ((deg - 90) * Math.PI) / 180
        return (
          <circle
            key={deg}
            cx={100 + Math.cos(r) * 58}
            cy={100 + Math.sin(r) * 58}
            r="3.2"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        )
      })}
    </svg>
  )
}

function CornerMarks() {
  return [
    'left-0 top-0',
    'right-0 top-0 -scale-x-100',
    'bottom-0 left-0 -scale-y-100',
    'bottom-0 right-0 -scale-x-100 -scale-y-100',
  ].map((pos) => (
    <svg
      key={pos}
      className={`pointer-events-none absolute h-5 w-5 text-gold/85 sm:h-6 sm:w-6 ${pos}`}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
    >
      <path d="M2 18 V2 H18" stroke="currentColor" strokeWidth="1.25" />
      <path d="M2 10 H10 V2" stroke="currentColor" strokeWidth="0.75" opacity="0.55" />
      <circle cx="2" cy="2" r="1.4" fill="currentColor" />
    </svg>
  ))
}

/**
 * Compact launch banner — same framed / corner language as before,
 * proportioned as a strip. Hides on/after 10 Oct 2026.
 */
export default function WelcomePromo() {
  const visible = useMemo(() => isPromoVisible(), [])
  const [copied, setCopied] = useState(false)
  const reduceMotion = useReducedMotion()

  if (!visible) return null

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  const enter = reduceMotion
    ? { initial: false, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 10 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-40px' },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
      }

  return (
    <section
      className="relative overflow-hidden bg-maroon-dark text-ivory"
      aria-label={`${PROMO_PERCENT}% welcome offer — code ${PROMO_CODE}`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(ellipse 50% 120% at 0% 50%, rgba(212,175,55,0.2), transparent 55%)',
            'linear-gradient(180deg, rgba(251,246,238,0.04), transparent 40%, rgba(0,0,0,0.18))',
          ].join(', '),
        }}
        aria-hidden
      />

      {/* Tight outer pad — frame sits close to section edges */}
      <div className="relative mx-auto max-w-6xl px-3 py-3 sm:px-5 sm:py-4">
        <div className="relative">
          <div className="absolute inset-0 border border-gold/40" aria-hidden />
          <div className="absolute inset-[3px] border border-gold/15 sm:inset-[4px]" aria-hidden />
          <CornerMarks />

          <motion.div
            {...enter}
            className="relative grid items-center gap-3 px-3.5 py-4 sm:gap-5 sm:px-6 sm:py-5
                       md:grid-cols-[auto_1fr] md:gap-8 md:px-8 md:py-5"
          >
            {/* Offer mark: horizontal on mobile (short), stacked on desktop */}
            <div className="relative flex items-center gap-3 md:min-w-[10.5rem] md:flex-col md:items-start md:gap-0">
              <JaalMark className="pointer-events-none absolute left-0 top-1/2 hidden h-32 w-32 -translate-y-1/2 text-gold/[0.12] md:block" />

              <p className="hidden text-[9px] font-semibold uppercase tracking-[0.26em] text-gold-light md:mb-1 md:block">
                Launch offer
              </p>

              <div className="relative flex items-end gap-0.5">
                <span className="font-display text-[2.85rem] leading-none tracking-tight text-ivory sm:text-[3.4rem] md:text-[4.25rem]">
                  {PROMO_PERCENT}
                </span>
                <div className="mb-0.5 flex flex-col items-start md:mb-1">
                  <span className="font-display text-xl leading-none text-gold sm:text-2xl">%</span>
                  <span className="mt-0.5 border-t border-gold/45 pt-0.5 font-display text-[10px] uppercase tracking-[0.16em] text-ivory/90 sm:text-[11px]">
                    off
                  </span>
                </div>
              </div>

              <p className="relative text-[10px] font-semibold uppercase leading-snug tracking-[0.14em] text-ivory/45 md:mt-2">
                Ends 9 Oct 2026
              </p>
            </div>

            {/* Divider — vertical on desktop only */}
            <div className="min-w-0 md:border-l md:border-gold/25 md:pl-8 lg:pl-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-light">
                {STUDIO.name}
              </p>

              <h2 className="mt-1 font-display text-[1.15rem] leading-snug text-ivory sm:text-[1.35rem] md:text-[1.5rem]">
                Now open to everyone—{' '}
                <span className="text-gold-light">with a welcome gift.</span>
              </h2>

              <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-ivory/65 sm:text-[13px]">
                {PROMO_PERCENT}% off at checkout. Catalog prices stay the same—use{' '}
                <span className="font-semibold text-ivory">{PROMO_CODE}</span> when you pay.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <button
                  type="button"
                  onClick={copyCode}
                  className="group relative flex min-h-[2.65rem] min-w-0 flex-1 items-center
                             overflow-hidden bg-ivory/[0.06] text-left
                             ring-1 ring-inset ring-gold/45 transition
                             hover:bg-ivory/[0.1] hover:ring-gold
                             focus-visible:ring-2 focus-visible:ring-gold"
                  aria-label={copied ? 'Code copied' : `Copy coupon code ${PROMO_CODE}`}
                >
                  <span
                    className="pointer-events-none absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2
                               rounded-full bg-maroon-dark ring-1 ring-gold/35"
                    aria-hidden
                  />
                  <span
                    className="pointer-events-none absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2
                               rounded-full bg-maroon-dark ring-1 ring-gold/35"
                    aria-hidden
                  />

                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-1.5 sm:px-3.5">
                    <span className="min-w-0">
                      <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-gold-light">
                        Your code
                      </span>
                      <span className="block truncate font-display text-lg tracking-[0.08em] text-ivory sm:text-xl">
                        {PROMO_CODE}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                        copied
                          ? 'bg-teal text-ivory'
                          : 'bg-gold text-ink group-hover:bg-gold-light'
                      }`}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </span>
                  </span>
                </button>

                <Link
                  to="/designs"
                  className="inline-flex min-h-[2.65rem] shrink-0 items-center justify-center
                             bg-ivory px-5 text-xs font-semibold tracking-wide text-maroon
                             transition-colors hover:bg-gold-light sm:min-w-[8.25rem] sm:text-sm"
                >
                  Explore designs
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
