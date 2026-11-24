// Copies jnaose src/components/Backdrop/print.ts at 5e8a66b (FADE,
// RESERVE_REM, Art, LANDSCAPE, PORTRAIT, pickArt, artTop, paintArt),
// with /samples paths in place of StaticImageData.

// Share of the drawn photo, from its bottom edge, that fades to black.
export const FADE = 0.22
// Viewport height, from the bottom, kept below the photo's dark row:
// room for a /work project's text (work.module.scss .text).
export const RESERVE_REM = 20

export interface Art {
  image: string
  // Share of the drawn photo's height pushed above the viewport.
  offset: number
  // Share of the photo's height from which its left half is solid black.
  dark: number
}

export const LANDSCAPE: Art = {
  image: '/samples/forest.jpg',
  offset: 0,
  dark: 0.84
}
export const PORTRAIT: Art = {
  image: '/samples/fireweed.jpg',
  offset: 0.375,
  dark: 0.94
}

export const pickArt = (w: number, h: number) =>
  w < h ? PORTRAIT : LANDSCAPE

// The photo's top edge: shifted up by its offset, and further when the
// viewport is too short to keep RESERVE_REM below its dark row.
export function artTop(art: Art, dh: number, h: number) {
  const rem = parseFloat(
    getComputedStyle(document.documentElement).fontSize
  )
  return Math.min(
    -art.offset * dh,
    h - RESERVE_REM * rem - art.dark * dh
  )
}

// The colour photo scaled to the viewport width, then black below it.
export function paintArt(
  img: HTMLImageElement,
  art: Art,
  w: number,
  h: number,
  dpr: number
) {
  const canvas = document.createElement('canvas')
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(dpr, dpr)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  const dh = (w * img.naturalHeight) / img.naturalWidth
  const top = artTop(art, dh, h)
  const bottom = top + dh
  ctx.drawImage(img, 0, top, w, dh)
  const fadeTop = bottom - dh * FADE
  const fade = ctx.createLinearGradient(
    0,
    fadeTop,
    0,
    bottom
  )
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(1, '#000')
  ctx.fillStyle = fade
  ctx.fillRect(0, fadeTop, w, bottom - fadeTop + 1)
  return canvas
}
