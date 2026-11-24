import {
  loadImage,
  type Printer,
  type PrintView
} from 'newspaper-image/core'

import { paintArt, pickArt } from './siteArt'

const dprNow = () => window.devicePixelRatio || 1

// The jnao.se Backdrop: the window is the view.
export const siteView = (): PrintView => ({
  W: window.innerWidth,
  H: window.innerHeight,
  origin: [0, 0],
  dpr: dprNow()
})

// "from" = bg.jpg, cover, left and vertically centred; "to" = the
// paintArt canvas at the window size, filling the view, repainted
// when the window width changes.
export function setupSite(
  printer: Printer,
  redraw: () => void
) {
  let cancelled = false
  let width = -1
  let paints = 0
  let frame = 0
  loadImage('/samples/bg.jpg').then((img) => {
    if (cancelled) return
    printer.setFrom(img, {
      fit: 'cover',
      position: [0, 0.5]
    })
    redraw()
  })
  const paint = () => {
    const w = window.innerWidth
    if (w === width) return
    width = w
    const h = window.innerHeight
    const dpr = dprNow()
    const art = pickArt(w, h)
    const paintNo = ++paints
    loadImage(art.image).then((img) => {
      if (cancelled || paintNo !== paints) return
      printer.setTo(paintArt(img, art, w, h, dpr), {
        fit: 'fill'
      })
      redraw()
    })
  }
  const onResize = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(paint)
  }
  paint()
  window.addEventListener('resize', onResize)
  return () => {
    cancelled = true
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', onResize)
  }
}

// The canvas's own CSS box is the view.
export const boxView = (
  canvas: HTMLCanvasElement
): PrintView => {
  const { width, height } = canvas.getBoundingClientRect()
  return {
    W: width,
    H: height,
    origin: [0, 0],
    dpr: dprNow()
  }
}

// bg.jpg → forest.jpg as plain images, cover, centred.
export function setupImages(
  printer: Printer,
  redraw: () => void
) {
  let cancelled = false
  Promise.all([
    loadImage('/samples/bg.jpg'),
    loadImage('/samples/forest.jpg')
  ]).then(([from, to]) => {
    if (cancelled) return
    printer.setFrom(from)
    printer.setTo(to)
    redraw()
  })
  return () => {
    cancelled = true
  }
}
