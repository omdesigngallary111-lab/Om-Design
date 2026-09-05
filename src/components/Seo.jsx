import { useEffect } from 'react'

const SITE_NAME = 'Om Design & Classes'
const SITE_ORIGIN = 'https://www.omdesignandclasses.com'

function setMeta(name, content, attr = 'name') {
  if (!content) return
  let tag = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setLink(rel, href) {
  if (!href) return
  let tag = document.head.querySelector(`link[rel="${rel}"]`)
  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', rel)
    document.head.appendChild(tag)
  }
  tag.setAttribute('href', href)
}

/**
 * Sets document.title + meta description/OG tags per page.
 * `brandFirst`: puts the studio name before the page title (homepage / brand pages).
 * `noIndex`: used on /admin/* and account pages.
 * `path`: optional path for canonical (defaults to current location).
 */
export default function Seo({
  title,
  description,
  noIndex = false,
  brandFirst = false,
  path,
}) {
  useEffect(() => {
    const fullTitle = !title
      ? SITE_NAME
      : brandFirst
        ? `${SITE_NAME} | ${title}`
        : `${title} | ${SITE_NAME}`

    document.title = fullTitle

    if (description) {
      setMeta('description', description)
      setMeta('og:description', description, 'property')
      setMeta('twitter:description', description)
    }

    setMeta('og:title', fullTitle, 'property')
    setMeta('og:site_name', SITE_NAME, 'property')
    setMeta('og:type', 'website', 'property')
    setMeta('og:image', `${SITE_ORIGIN}/icon-512.png`, 'property')
    setMeta('twitter:card', 'summary')
    setMeta('twitter:title', fullTitle)
    setMeta('robots', noIndex ? 'noindex, nofollow' : 'index, follow')

    const canonicalPath =
      path ??
      `${window.location.pathname}${window.location.search}` ??
      '/'
    const normalized = canonicalPath.startsWith('/')
      ? canonicalPath
      : `/${canonicalPath}`
    const canonical = `${SITE_ORIGIN}${normalized === '' ? '/' : normalized}`
    setLink('canonical', canonical)
    setMeta('og:url', canonical, 'property')
  }, [title, description, noIndex, brandFirst, path])

  return null
}
