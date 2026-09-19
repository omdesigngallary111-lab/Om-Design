import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Keep absolute base '/' so nested routes (/designs/:slug) still resolve
// /assets/* correctly. Capacitor's WebView loads the bundle from the app
// origin root, so this is safe for both web and native.
export default defineConfig({
  plugins: [react()],
})
