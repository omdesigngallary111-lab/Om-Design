import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from '@capacitor/app'
import { initNativeShell, isNativePlatform } from '../lib/native.js'
import { pathFromDeepLink } from '../lib/deepLinks.js'

/**
 * Capacitor-only shell: status bar / splash, Android back button, and
 * Universal/App Link routing into React Router.
 */
export default function NativeShell() {
  const navigate = useNavigate()

  useEffect(() => {
    initNativeShell()
  }, [])

  useEffect(() => {
    if (!isNativePlatform()) return undefined

    let backHandle
    let urlHandle

    const openDeepLink = (rawUrl) => {
      const path = pathFromDeepLink(rawUrl)
      if (!path) return
      navigate(path, { replace: true })
    }

    const setup = async () => {
      backHandle = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          App.exitApp()
        }
      })

      urlHandle = await App.addListener('appUrlOpen', (event) => {
        openDeepLink(event.url)
      })

      // Cold start from a shared https link
      try {
        const launch = await App.getLaunchUrl()
        if (launch?.url) openDeepLink(launch.url)
      } catch {
        // getLaunchUrl unavailable / no launch URL
      }
    }

    setup()

    return () => {
      backHandle?.remove()
      urlHandle?.remove()
    }
  }, [navigate])

  return null
}
