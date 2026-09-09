import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Instant jump to the top of the page.
 * Mobile browsers often re-scroll a focused pagination control into view
 * after a re-render — blur first, then set scroll on every scroll root,
 * and retry after paint so async layout (e.g. designs grid) cannot win.
 */
export function scrollPageToTop() {
  if (typeof window === 'undefined') return

  const active = document.activeElement
  if (
    active instanceof HTMLElement &&
    active !== document.body &&
    typeof active.blur === 'function'
  ) {
    active.blur()
  }

  const html = document.documentElement
  const previousBehavior = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'

  const jump = () => {
    window.scrollTo(0, 0)
    html.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
  }

  jump()
  requestAnimationFrame(() => {
    jump()
    requestAnimationFrame(() => {
      jump()
      html.style.scrollBehavior = previousBehavior
    })
  })
}

/**
 * Reset window scroll on route / query changes so each page (and
 * URL-driven pagination like /designs?page=2) starts at the top.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    scrollPageToTop()
  }, [pathname, search])

  return null
}
