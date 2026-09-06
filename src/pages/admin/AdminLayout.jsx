import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import BrandMark from '../../components/BrandMark.jsx'
import Seo from '../../components/Seo.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { isAdmin, isStaff, roleLabel } from '../../lib/roles.js'
import {
  IconDashboard,
  IconPackage,
  IconFolder,
  IconLayers,
  IconShapes,
  IconRuler,
  IconImage,
  IconFile,
  IconUsers,
  IconOrders,
  IconTag,
  IconArrowLeft,
  IconMenu,
  IconX,
} from '../../components/admin/icons.jsx'

const allNavItems = [
  { to: '/admin', label: 'Dashboard', end: true, icon: IconDashboard, adminOnly: true },
  { to: '/admin/products', label: 'Products', icon: IconPackage, adminOnly: true },
  { to: '/admin/categories', label: 'Categories', icon: IconFolder, adminOnly: true },
  { to: '/admin/subcategories', label: 'Subcategories', icon: IconLayers, adminOnly: true },
  { to: '/admin/admissions', label: 'Admissions', icon: IconFile, adminOnly: false },
  { to: '/admin/design-types', label: 'Design Types', icon: IconShapes, adminOnly: true },
  { to: '/admin/area-needle', label: 'Area & Needle', icon: IconRuler, adminOnly: true },
  { to: '/admin/offers', label: 'Offers', icon: IconTag, adminOnly: true },
  { to: '/admin/carousel', label: 'Carousel', icon: IconImage, adminOnly: true },
  { to: '/admin/users', label: 'Users', icon: IconUsers, adminOnly: true },
  { to: '/admin/orders', label: 'Orders', icon: IconOrders, adminOnly: true },
]

function NavList({ items, onNavigate }) {
  const navigate = useNavigate()

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={(e) => {
              // Close first, then navigate — avoids mobile tap falling through
              // a full-screen backdrop and the drawer staying open.
              e.preventDefault()
              onNavigate?.()
              navigate(item.to)
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold
               transition-colors duration-150 ${
                 isActive
                   ? 'bg-maroon text-ivory shadow-sm'
                   : 'text-ink-soft hover:bg-sand hover:text-ink'
               }`
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}

function Brand({ stacked = false, subtitle = 'Admin', onNavigate }) {
  return (
    <BrandMark
      compact
      subtitle={subtitle}
      stacked={stacked}
      onClick={onNavigate}
    />
  )
}

function SidebarFooter({ onNavigate }) {
  const { profile, user } = useAuth()
  const name = profile?.full_name || user?.phone || 'User'
  const initial = (name.trim()[0] || 'U').toUpperCase()
  const label = roleLabel(profile?.role)

  return (
    <div className="mt-auto pt-6 border-t border-ink/8">
      <div className="flex items-center gap-3 px-1 mb-4">
        <div className="w-8 h-8 rounded-full bg-maroon/10 text-maroon text-xs font-bold flex items-center justify-center">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{name}</p>
          <p className="text-[11px] text-ink-soft">{label}</p>
        </div>
      </div>
      <Link
        to="/"
        onClick={() => onNavigate?.()}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-ink-soft
                   hover:text-maroon hover:bg-sand transition-colors duration-150"
      >
        <IconArrowLeft className="w-3.5 h-3.5" />
        Back to site
      </Link>
    </div>
  )
}

function MobileDrawer({ open, onClose, navItems, brandSubtitle }) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex lg:hidden" role="presentation">
      {/* Panel first — not under a full-screen overlay, so taps hit the links */}
      <aside
        className="flex h-full w-[min(280px,86vw)] flex-col border-r border-ink/8
                   bg-ivory px-3 py-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Office menu"
      >
        <div className="mb-6 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 overflow-hidden pr-1">
            <Brand stacked subtitle={brandSubtitle} onNavigate={onClose} />
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                       text-ink-soft transition-colors duration-150 hover:bg-sand hover:text-ink"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
        <NavList items={navItems} onNavigate={onClose} />
        <SidebarFooter onNavigate={onClose} />
      </aside>

      {/* Dimmed area only beside the panel */}
      <button
        type="button"
        className="h-full min-w-0 flex-1 border-0 bg-ink/40 backdrop-blur-sm"
        aria-label="Close menu"
        onClick={onClose}
      />
    </div>,
    document.body,
  )
}

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { profile } = useAuth()
  const admin = isAdmin(profile?.role)
  const staff = isStaff(profile?.role)

  const navItems = useMemo(
    () => allNavItems.filter((item) => admin || !item.adminOnly),
    [admin],
  )

  const brandSubtitle = staff && !admin ? 'Staff' : 'Admin'
  const seoTitle = staff && !admin ? 'Admissions' : 'Admin'

  const closeMobile = () => setMobileOpen(false)

  // Sync close before paint whenever the route changes
  useLayoutEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-sand flex">
      <Seo title={seoTitle} noIndex />

      <aside className="hidden lg:flex w-[252px] shrink-0 sticky top-0 h-screen flex-col bg-ivory border-r border-ink/8 px-3 py-5">
        <div className="mb-6 min-w-0 max-w-full">
          <Brand stacked subtitle={brandSubtitle} />
        </div>
        <NavList items={navItems} />
        <SidebarFooter />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-50 bg-ivory/95 backdrop-blur border-b border-ink/8">
          <div className="flex items-center justify-between gap-2 px-3 min-h-14 py-1">
            <div className="min-w-0 flex-1 overflow-hidden">
              <Brand subtitle={brandSubtitle} />
            </div>
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center
                         rounded-xl text-ink transition-colors duration-150 hover:bg-sand"
            >
              {mobileOpen ? <IconX className="w-5 h-5" /> : <IconMenu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <MobileDrawer
          open={mobileOpen}
          onClose={closeMobile}
          navItems={navItems}
          brandSubtitle={brandSubtitle}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-10">
          <div className="max-w-6xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
