import {
  loadImage,
  type Placement,
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

const PLACE_LEFT: Placement = {
  fit: 'cover',
  position: [0, 0.5]
}

// The print-raster prototype's photo for the window: forest.jpg when
// landscape, fireweed.jpg when portrait.
const prototypePhoto = () =>
  window.innerWidth >= window.innerHeight
    ? '/samples/forest.jpg'
    : '/samples/fireweed.jpg'

// The print-raster prototype's page: the window is the view, "from" =
// bg.jpg and "to" = prototypePhoto(), both cover, left and vertically
// centred. "to" is swapped when a resize changes the orientation.
export function setupPrototype(
  printer: Printer,
  redraw: () => void
) {
  let cancelled = false
  let photo = ''
  let loads = 0
  loadImage('/samples/bg.jpg').then((img) => {
    if (cancelled) return
    printer.setFrom(img, PLACE_LEFT)
    redraw()
  })
  const pick = () => {
    const src = prototypePhoto()
    if (src === photo) return
    photo = src
    const loadNo = ++loads
    loadImage(src).then((img) => {
      if (cancelled || loadNo !== loads) return
      printer.setTo(img, PLACE_LEFT)
      redraw()
    })
  }
  pick()
  window.addEventListener('resize', pick)
  return () => {
    cancelled = true
    window.removeEventListener('resize', pick)
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

const SAMPLES = [
  '/samples/bg.jpg',
  '/samples/forest.jpg',
  '/samples/fireweed.jpg'
]
const PLACEMENTS: Placement[] = [
  {},
  { fit: 'cover', position: [0, 0.5] },
  { fit: 'fill' },
  { fit: 'cover', position: [1, 0.5] },
  { fit: 'cover', position: [0.5, 0] }
]

const loads = new Map<string, Promise<HTMLImageElement>>()
const loadOnce = (src: string) => {
  let load = loads.get(src)
  if (!load) {
    load = loadImage(src)
    loads.set(src, load)
  }
  return load
}

// One grid cell's sources: "from" = SAMPLES[i % 3]; "to" is the same
// image every fourth cell, else the next sample; placements cycle
// through PLACEMENTS.
function setupCell(i: number) {
  const from = SAMPLES[i % 3]
  const to = i % 4 === 0 ? from : SAMPLES[(i + 1) % 3]
  return (printer: Printer, redraw: () => void) => {
    let cancelled = false
    Promise.all([loadOnce(from), loadOnce(to)]).then(
      ([a, b]) => {
        if (cancelled) return
        printer.setFrom(a, PLACEMENTS[i % 5])
        printer.setTo(b, PLACEMENTS[(i + 2) % 5])
        redraw()
      }
    )
    return () => {
      cancelled = true
    }
  }
}

// The grid scene's 24 cells, each printed in its own CSS box.
export const GRID_CELLS = Array.from(
  { length: 24 },
  (_, i) => ({ id: `cell-${i}`, setup: setupCell(i) })
)
