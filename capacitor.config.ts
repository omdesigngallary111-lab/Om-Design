import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Bundled native app — webDir must stay 'dist' (Vite build output).
 * Never point server.url at the live site; that would be a thin WebView wrapper.
 *
 * Native builds: npm run cap:build  →  then open/run Android or sync iOS via Codemagic.
 */
const config: CapacitorConfig = {
  appId: 'com.omdesignandclasses.app',
  appName: 'Om Design & Classes',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#FBF6EE',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FBF6EE',
    },
    Camera: {
      // Permissions are declared in AndroidManifest / Info.plist via the plugin.
    },
  },
}

export default config
