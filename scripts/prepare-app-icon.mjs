import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const IVORY = { r: 251, g: 246, b: 238, alpha: 1 }
const SRC = 'public/icon-512.png'

await mkdir('resources', { recursive: true })

const ivorySvg = (w, h) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#FBF6EE"/></svg>`,
  )

// Trim whitespace, then circular-mask so the external ® is excluded from
// home-screen icon sizes.
const trimmed = await sharp(SRC).trim({ threshold: 12 }).png().toBuffer()
const { width, height } = await sharp(trimmed).metadata()
const side = Math.min(width, height)
// Slight inset so the ® (outside the ring) is cropped away.
const inset = Math.round(side * 0.02)
const cropSize = side - inset * 2
const left = Math.round((width - cropSize) / 2)
const top = Math.round((height - cropSize) / 2)

const circleMask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${cropSize}" height="${cropSize}">
    <circle cx="${cropSize / 2}" cy="${cropSize / 2}" r="${cropSize / 2}" fill="white"/>
  </svg>`,
)

const circularLogo = await sharp(trimmed)
  .extract({ left, top, width: cropSize, height: cropSize })
  .composite([{ input: circleMask, blend: 'dest-in' }])
  .png()
  .toBuffer()

async function placeOnIvory(canvasSize, logoSize, outPath) {
  const logo = await sharp(circularLogo)
    .resize(logoSize, logoSize, { fit: 'contain', background: IVORY })
    .png()
    .toBuffer()
  await sharp(ivorySvg(canvasSize, canvasSize))
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(outPath)
}

await placeOnIvory(1024, 860, 'resources/icon.png')
await placeOnIvory(2732, 900, 'resources/splash.png')

for (const size of [48, 96, 192]) {
  await sharp('resources/icon.png')
    .resize(size, size)
    .png()
    .toFile(`resources/preview-${size}.png`)
}

console.log('Wrote cleaned circular icon + splash + previews')
