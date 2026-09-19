/**
 * Deep-link hosts that should open inside the installed app.
 * Keep in sync with AndroidManifest intent-filters and .well-known files.
 */
export const DEEP_LINK_HOSTS = [
  'www.omdesignandclasses.com',
  'omdesignandclasses.com',
]

export const SITE_ORIGIN = 'https://www.omdesignandclasses.com'

/**
 * Turn a full https URL (or capacitor launch URL) into an in-app path
 * for React Router, e.g. "/designs/some-slug".
 * Returns null if the URL is not one of ours.
 */
export function pathFromDeepLink(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null

  try {
    const url = new URL(rawUrl)
    if (!DEEP_LINK_HOSTS.includes(url.hostname)) return null
    return `${url.pathname}${url.search}${url.hash}` || '/'
  } catch {
    // Relative path already
    if (rawUrl.startsWith('/')) return rawUrl
    return null
  }
}
