# Deep link verification (production)

These files are served from the Vite `public/` folder at:

- `https://www.omdesignandclasses.com/.well-known/assetlinks.json`
- `https://www.omdesignandclasses.com/.well-known/apple-app-site-association`

## Android (`assetlinks.json`)

Current fingerprint is the **local debug keystore** (for device testing):

`C6:37:95:14:F9:4A:7C:BC:AB:21:3D:C9:09:23:AE:44:F2:A5:17:9E:2C:E9:21:9F:27:A9:3D:5A:60:22:00:19`

Before Play Store release, run `.\scripts\create-android-keystore.ps1`, then
add the printed **release** SHA-256 to the `sha256_cert_fingerprints` array
(keep the debug one only if you still need local App Link testing).

You can also copy the fingerprint later from Play Console → App signing
(if you enroll in Play App Signing).

## iOS (`apple-app-site-association`)

**Deferred** — wait for an Apple Developer Team ID before filling `TEAMID`
and enabling Universal Links / Codemagic iOS builds.
