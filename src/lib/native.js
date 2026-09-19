import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Share } from '@capacitor/share'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SITE_ORIGIN } from './deepLinks.js'

export { SITE_ORIGIN } from './deepLinks.js'

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}

/**
 * Open the native camera/gallery prompt and return a File suitable for
 * existing upload helpers. Returns null if the user cancels.
 */
export async function pickNativeImage({
  source = CameraSource.Prompt,
  quality = 90,
  fileName = 'photo.jpg',
} = {}) {
  const photo = await Camera.getPhoto({
    quality,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source,
    correctOrientation: true,
  })

  if (!photo.webPath) {
    throw new Error('Camera returned no image path')
  }

  const response = await fetch(photo.webPath)
  const blob = await response.blob()
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const name = fileName.includes('.') ? fileName : `${fileName}.${ext}`
  return new File([blob], name, { type: blob.type || 'image/jpeg' })
}

/**
 * Native OS share sheet when available; web uses Web Share API or throws
 * so the caller can fall back to clipboard.
 */
export async function shareContent({ title, text, url, dialogTitle } = {}) {
  if (isNativePlatform()) {
    await Share.share({
      title: title || undefined,
      text: text || undefined,
      url: url || undefined,
      dialogTitle: dialogTitle || undefined,
    })
    return { method: 'native' }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({
      title: title || undefined,
      text: text || undefined,
      url: url || undefined,
    })
    return { method: 'web-share' }
  }

  throw new Error('SHARE_UNAVAILABLE')
}

export async function initNativeShell() {
  if (!isNativePlatform()) return

  try {
    await StatusBar.setStyle({ style: Style.Dark })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#FBF6EE' })
    }
  } catch {
    // StatusBar may be unavailable on some emulators; ignore.
  }

  try {
    await SplashScreen.hide()
  } catch {
    // Splash already hidden or plugin not ready.
  }
}
