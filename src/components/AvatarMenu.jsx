import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { canAccessAdmissions, defaultPathForRole, isAdmin } from '../lib/roles.js'

function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

export default function AvatarMenu({ compact = false }) {
  const { profile, user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const initial =
    profile?.full_name?.trim()?.[0]?.toUpperCase() ??
    user?.phone?.slice(-2) ??
    '•'

  const walletBalance = Number(profile?.wallet_balance ?? 0)
  const panelPath = defaultPathForRole(profile?.role)
  const showOfficeLink = canAccessAdmissions(profile?.role)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className={`relative flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`} ref={ref}>
      <Link
        to="/account"
        className={`inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white
                   font-semibold text-ink hover:border-maroon/30 active:scale-[0.98]
                   transition-[border-color,transform] duration-150
                   ${compact ? 'pl-2 pr-2.5 py-1.5 text-[11px] shadow-sm' : 'px-3 py-1.5 text-xs'}`}
        title="Wallet balance"
        aria-label={`Wallet ${formatMoney(walletBalance)}`}
      >
        <span
          className={`inline-flex items-center justify-center rounded-full bg-gold/20 text-gold-dark shrink-0 ${
            compact ? 'w-5 h-5' : 'w-5 h-5 mr-0.5'
          }`}
          aria-hidden="true"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8.5h15.5a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5Zm0 0V7a2 2 0 0 1 2-2h11"
            />
            <circle cx="17.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </span>
        {!compact && <span className="text-ink-soft font-medium">Wallet</span>}
        <span className="tabular-nums text-maroon leading-none">{formatMoney(walletBalance)}</span>
      </Link>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`${compact ? 'w-9 h-9 text-xs ring-1 ring-maroon/15' : 'w-10 h-10 text-sm'}
                   rounded-full bg-maroon text-ivory font-semibold
                   flex items-center justify-center hover:bg-maroon-light
                   active:scale-[0.96] transition-[background-color,transform]`}
      >
        {initial}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-56 bg-white rounded-sm shadow-card border border-ink/10 py-2 z-50 top-full"
          >
            <p className="px-4 py-2 text-xs text-ink-soft/70 border-b border-ink/10 truncate">
              {profile?.full_name || user?.phone}
            </p>
            <div className="px-4 py-2 border-b border-ink/10">
              <p className="text-[11px] uppercase tracking-wider text-ink-soft">Wallet balance</p>
              <p className="mt-1 text-sm font-semibold text-maroon tabular-nums">
                {formatMoney(walletBalance)}
              </p>
            </div>
            <Link
              to="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm hover:bg-sand"
            >
              My Account
            </Link>
            <Link
              to="/cart"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm hover:bg-sand"
            >
              Cart
            </Link>
            <Link
              to="/wishlist"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm hover:bg-sand"
            >
              Wishlist
            </Link>
            {showOfficeLink && (
              <Link
                to={panelPath}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm hover:bg-sand"
              >
                {isAdmin(profile?.role) ? 'Admin panel' : 'Admissions'}
              </Link>
            )}
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                signOut()
              }}
              className="block w-full text-left px-4 py-2 text-sm text-maroon hover:bg-sand"
            >
              Logout
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
