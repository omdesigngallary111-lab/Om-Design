/**
 * Generate Android (and future iOS) launcher icons + splash screens from
 * resources/icon.png and resources/splash.png using the top-level sharp
 * package (avoids @capacitor/assets' nested sharp native build on Windows).
 *
 * Usage: node scripts/generate-native-assets.mjs
 */
import sharp from 'sharp'
import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

const ICON = 'resources/icon.png'
const SPLASH = 'resources/splash.png'
const IVORY = { r: 251, g: 246, b: 238, alpha: 1 }

const ANDROID_ICON_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
}

// Adaptive icon foreground (Android): 108dp base × density
const ANDROID_FG_SIZES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
}

const ANDROID_SPLASH = [
  ['drawable', 480, 320],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
]

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true })
}

async function writePng(buf, outPath) {
  await ensureDir(outPath)
  await writeFile(outPath, buf)
}

async function resizeContain(src, size, background = IVORY) {
  return sharp(src)
    .resize(size, size, { fit: 'contain', background })
    .png()
    .toBuffer()
}

async function splashFrame(src, width, height) {
  const logoMax = Math.round(Math.min(width, height) * 0.42)
  const logo = await sharp(src)
    .resize(logoMax, logoMax, { fit: 'contain', background: IVORY })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 251, g: 246, b: 238 },
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer()
}

async function generateAndroid() {
  const resRoot = 'android/app/src/main/res'
  if (!existsSync(resRoot)) {
    console.warn('android/ not found — skip Android assets')
    return
  }

  for (const [folder, size] of Object.entries(ANDROID_ICON_SIZES)) {
    const buf = await resizeContain(ICON, size)
    const round = await sharp(buf)
      .composite([
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
              <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
            </svg>`,
          ),
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer()

    await writePng(buf, join(resRoot, folder, 'ic_launcher.png'))
    await writePng(round, join(resRoot, folder, 'ic_launcher_round.png'))
  }

  for (const [folder, size] of Object.entries(ANDROID_FG_SIZES)) {
    // Safe zone ~66% of adaptive canvas
    const logoSize = Math.round(size * 0.66)
    const logo = await resizeContain(ICON, logoSize)
    const fg = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 251, g: 246, b: 238, alpha: 1 },
      },
    })
      .composite([{ input: logo, gravity: 'centre' }])
      .png()
      .toBuffer()
    await writePng(fg, join(resRoot, folder, 'ic_launcher_foreground.png'))
  }

  // Solid ivory adaptive background
  const anydpi = join(resRoot, 'mipmap-anydpi-v26')
  await mkdir(anydpi, { recursive: true })
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/colorIvory"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`
  await writeFile(join(anydpi, 'ic_launcher.xml'), adaptiveXml)
  await writeFile(join(anydpi, 'ic_launcher_round.xml'), adaptiveXml)

  for (const [folder, w, h] of ANDROID_SPLASH) {
    const buf = await splashFrame(SPLASH, w, h)
    await writePng(buf, join(resRoot, folder, 'splash.png'))
  }

  console.log('Android icons + splash screens written under', resRoot)
}

async function generatePwaCopies() {
  // Keep web favicons aligned with the cleaned mark
  await copyFile(ICON, 'resources/icon-source.png')
  const fav32 = await resizeContain(ICON, 32)
  const fav48 = await resizeContain(ICON, 48)
  const icon192 = await resizeContain(ICON, 192)
  const icon512 = await resizeContain(ICON, 512)
  await writePng(fav32, 'public/favicon-32x32.png')
  await writePng(fav48, 'public/favicon-48x48.png')
  await writePng(icon192, 'public/icon-192.png')
  await writePng(icon512, 'public/icon-512.png')
  await writePng(icon192, 'public/apple-touch-icon.png')
  console.log('Updated public/ PWA icons from cleaned source')
}

if (!existsSync(ICON) || !existsSync(SPLASH)) {
  console.error('Missing resources/icon.png or resources/splash.png — run npm run prepare:icons first')
  process.exit(1)
}

await generateAndroid()
await generatePwaCopies()
console.log('Done.')
