import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Reset window scroll on route / query changes so each page (and
 * URL-driven pagination like /designs?page=2) starts at the top.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    // Prefer instant jump — smooth scroll feels like a bug after navigation.
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, search])

  return null
}

/** Shared helper for client-side pagination (state-only page changes). */
export function scrollPageToTop() {
  if (typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  } else {
    window.scrollTo(0, 0)
  }
}
