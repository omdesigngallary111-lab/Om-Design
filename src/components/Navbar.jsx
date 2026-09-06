import { useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import AvatarMenu from './AvatarMenu.jsx'
import BrandMark from './BrandMark.jsx'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/categories', label: 'Categories' },
  { to: '/designs', label: 'All Designs', shortLabel: 'Designs' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

const GAP_PX = 20
const MORE_BTN_PX = 44

function desktopLinkClass(isActive) {
  return `text-sm font-semibold tracking-wide whitespace-nowrap transition-colors duration-150 ${
    isActive ? 'text-maroon' : 'text-ink-soft hover:text-maroon'
  }`
}

function mobileLinkClass(isActive) {
  return `relative shrink-0 text-[13px] font-semibold tracking-wide whitespace-nowrap py-2.5 transition-colors duration-150 ${
    isActive ? 'text-maroon' : 'text-ink-soft'
  }`
}

/**
 * Measures how many nav labels fit in the phone second row.
 * If every link fits, the hamburger is hidden.
 */
function useFittingLinkCount(total) {
  const containerRef = useRef(null)
  const measureRef = useRef(null)
  const [visibleCount, setVisibleCount] = useState(Math.min(3, total))

  useLayoutEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return undefined

    const calc = () => {
      const available = container.clientWidth
      if (available <= 0) return

      const widths = [...measure.children].map((el) => el.getBoundingClientRect().width)
      const totalWidth =
        widths.reduce((sum, w) => sum + w, 0) + GAP_PX * Math.max(0, widths.length - 1)

      if (totalWidth <= available) {
        setVisibleCount(widths.length)
        return
      }

      let used = 0
      let count = 0
      for (let i = 0; i < widths.length; i++) {
        const next = used + widths[i] + (count > 0 ? GAP_PX : 0)
        if (next + MORE_BTN_PX <= available) {
          used = next
          count += 1
        } else {
          break
        }
      }
      setVisibleCount(Math.max(2, count))
    }

    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(container)
    return () => ro.disconnect()
  }, [total])

  return { containerRef, measureRef, visibleCount }
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { session, loading } = useAuth()
  const { count: cartCount } = useCart()
  const navigate = useNavigate()
  const { containerRef, measureRef, visibleCount } = useFittingLinkCount(links.length)

  const inlineLinks = links.slice(0, visibleCount)
  const overflowLinks = links.slice(visibleCount)
  const showMore = overflowLinks.length > 0

  const closeMenu = () => setOpen(false)

  useLayoutEffect(() => {
    if (!showMore && open) setOpen(false)
  }, [showMore, open])

  const cartLink = (
    <Link
      to={session ? '/cart' : '/login'}
      state={session ? undefined : { from: '/cart' }}
      aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/10
                 bg-white text-ink hover:border-maroon/30 hover:text-maroon transition-colors"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 6h15l-1.5 9h-12z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M6 6 5 3H2"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="20" r="1.25" fill="currentColor" />
        <circle cx="18" cy="20" r="1.25" fill="currentColor" />
      </svg>
      {session && cartCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full
                         bg-maroon px-1 text-[10px] font-bold leading-none text-ivory">
          {cartCount > 99 ? '99+' : cartCount}
        </span>
      )}
    </Link>
  )

  const accountSlot = (
    <>
      {cartLink}
      {!loading && session && (
        <>
          <span className="lg:hidden">
            <AvatarMenu compact />
          </span>
          <span className="hidden lg:inline-flex">
            <AvatarMenu />
          </span>
        </>
      )}
      {!loading && !session && (
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="btn-primary !py-2 !px-4 !text-xs max-md:rounded-full max-md:!px-3.5 max-md:!py-1.5 max-md:text-[12px]"
        >
          Login
        </button>
      )}
    </>
  )

  return (
    <header className="sticky top-0 z-40 bg-ivory/95 backdrop-blur border-b border-ink/10">
      {/*
        Tablet + desktop: one row (md+).
        Phone only: two rows — brand/account, then fitting nav.
        Two-row looked sparse/broken on tablets (~768–1023).
      */}
      <nav className="hidden md:flex max-w-6xl mx-auto items-center justify-between gap-2 lg:gap-3 px-3 sm:px-5 h-16 lg:h-[4.5rem] min-w-0">
        <div className="shrink-0 min-w-0">
          <span className="lg:hidden">
            <BrandMark compact hideSubtitle />
          </span>
          <span className="hidden lg:block">
            <BrandMark />
          </span>
        </div>

        <div className="flex items-center justify-center flex-1 min-w-0 px-1">
          <div className="flex items-center gap-3 lg:gap-3 xl:gap-5">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => desktopLinkClass(isActive)}
              >
                {link.shortLabel ? (
                  <>
                    <span className="xl:hidden">{link.shortLabel}</span>
                    <span className="hidden xl:inline">{link.label}</span>
                  </>
                ) : (
                  link.label
                )}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 lg:gap-2.5">{accountSlot}</div>
      </nav>

      {/* Phone — two rows */}
      <div className="md:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-3.5 sm:px-5 min-h-[3.25rem] py-2">
          <div className="shrink-0 min-w-0 flex-1 pr-2">
            <BrandMark compact hideSubtitle onClick={closeMenu} />
          </div>
          <div className="shrink-0 flex items-center gap-2">{accountSlot}</div>
        </div>

        <div className="border-t border-ink/[0.06] bg-sand/40">
          <div className="max-w-6xl mx-auto flex items-stretch gap-1 px-2 sm:px-4 min-h-11">
            <div
              ref={measureRef}
              className="fixed left-[-9999px] top-0 flex items-center gap-5 whitespace-nowrap"
              aria-hidden="true"
            >
              {links.map((link) => (
                <span key={link.to} className="text-[13px] font-semibold tracking-wide">
                  {link.shortLabel || link.label}
                </span>
              ))}
            </div>

            <div
              ref={containerRef}
              className="flex-1 min-w-0 flex items-center justify-around sm:justify-start sm:gap-5 overflow-hidden px-1"
            >
              {inlineLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={closeMenu}
                  className={({ isActive }) => mobileLinkClass(isActive)}
                >
                  {({ isActive }) => (
                    <>
                      {link.shortLabel || link.label}
                      <span
                        className={`absolute left-0 right-0 -bottom-px h-0.5 rounded-full transition-colors ${
                          isActive ? 'bg-gold' : 'bg-transparent'
                        }`}
                        aria-hidden="true"
                      />
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            {showMore && (
              <button
                type="button"
                className={`shrink-0 self-center w-10 h-10 inline-flex items-center justify-center rounded-lg
                           transition-colors ${
                             open ? 'bg-maroon/10 text-maroon' : 'text-ink-soft hover:bg-ink/[0.04]'
                           }`}
                aria-label={open ? 'Close menu' : 'More links'}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  {open ? (
                    <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  ) : (
                    <path strokeWidth="2" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && showMore && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-ink/10 bg-ivory"
          >
            <div className="px-2 py-2">
              {overflowLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `block rounded-lg px-3.5 py-3 text-[15px] font-semibold transition-colors ${
                      isActive ? 'bg-maroon/8 text-maroon' : 'text-ink-soft hover:bg-sand'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
