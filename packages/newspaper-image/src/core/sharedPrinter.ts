import type { Placement } from './geometry.js'
import {
  applySettings,
  build,
  disposePlate,
  drawPlate,
  FROM_UNIT,
  type Plate,
  type PlateSide,
  TO_UNIT,
  upload
} from './plate.js'
import type {
  Printer,
  PrinterOptions,
  PrintState,
  PrintView
} from './printer.js'
import {
  DEFAULT_SETTINGS,
  type PrintSettings
} from './settings.js'

export type SharedPrinterOptions = Omit<
  PrinterOptions,
  'preserveDrawingBuffer'
>

interface Side {
  source: TexImageSource | null
  placement: Placement
}

interface Image {
  target: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  options: SharedPrinterOptions
  settings: PrintSettings
  from: Side
  to: Side
  // One texture per distinct source the sides hold.
  textures: Map<TexImageSource, WebGLTexture>
  last: string
}

interface Page {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  plate: Plate
  applied: PrintSettings | null
  images: Set<Image>
}

// The page-wide offscreen context, created by the first
// createSharedPrinter and released by the last dispose.
let page: Page | null = null
// Set once WebGL2 is missing or the shader fails to build.
let unavailable = false

function open(): Page | null {
  if (unavailable) return null
  if (page) return page
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true
  })
  const plate = gl && build(gl)
  if (!gl || !plate) {
    unavailable = true
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return null
  }
  page = {
    canvas,
    gl,
    plate,
    applied: null,
    images: new Set()
  }
  return page
}

function close(p: Page) {
  disposePlate(p.gl, p.plate)
  p.gl.getExtension('WEBGL_lose_context')?.loseContext()
  if (page === p) page = null
}

// Deletes the textures of sources neither side holds.
function release(gl: WebGL2RenderingContext, image: Image) {
  for (const [source, texture] of image.textures) {
    if (
      source === image.from.source ||
      source === image.to.source
    )
      continue
    gl.deleteTexture(texture)
    image.textures.delete(source)
  }
}

// A printer that prints into `target`'s 2D context through one
// offscreen WebGL2 context shared by every shared printer on the
// page. Null without WebGL2, when the shader fails to build, or when
// `target` has no 2D context. The caller sizes `target`'s backing
// store. A source both sides hold is one texture; setting a source a
// side already holds uploads it again.
export function createSharedPrinter(
  target: HTMLCanvasElement,
  options: SharedPrinterOptions = {}
): Printer | null {
  const ctx = target.getContext('2d')
  if (!ctx) return null
  const p = open()
  if (!p) return null
  const { gl } = p

  const image: Image = {
    target,
    ctx,
    options,
    settings: options.settings ?? DEFAULT_SETTINGS,
    from: { source: null, placement: {} },
    to: { source: null, placement: {} },
    textures: new Map(),
    last: ''
  }
  p.images.add(image)

  const setSide = (
    side: Side,
    unit: number,
    source: TexImageSource,
    placement: Placement = {}
  ) => {
    if (!p.images.has(image)) return
    const held = image.textures.get(source)
    if (!held || side.source === source) {
      image.textures.set(
        source,
        upload(gl, unit, source, held ?? null)
      )
    }
    image.last = ''
    side.source = source
    side.placement = placement
    release(gl, image)
  }

  const sideOf = (side: Side): PlateSide | null => {
    const texture =
      side.source && image.textures.get(side.source)
    return side.source && texture
      ? {
          source: side.source,
          placement: side.placement,
          texture
        }
      : null
  }

  return {
    setFrom(source, placement) {
      setSide(image.from, FROM_UNIT, source, placement)
    },
    setTo(source, placement) {
      setSide(image.to, TO_UNIT, source, placement)
    },
    setSettings(next) {
      image.settings = next
      image.last = ''
    },
    draw(view: PrintView, state: PrintState) {
      if (!p.images.has(image)) return false
      const from = sideOf(image.from)
      const to = sideOf(image.to)
      if (!from || !to) return false
      const { width, height } = target
      const { W, H, origin, dpr } = view
      const { time, fade, press = 1 } = state
      const key = [
        W,
        H,
        origin,
        dpr,
        time,
        fade,
        press,
        width,
        height
      ].join()
      if (key === image.last) return true
      const { canvas } = p
      if (canvas.width < width) canvas.width = width
      if (canvas.height < height) canvas.height = height
      if (p.applied !== image.settings) {
        applySettings(gl, p.plate.u, image.settings)
        p.applied = image.settings
      }
      drawPlate(
        gl,
        p.plate,
        from,
        to,
        image.settings,
        view,
        state,
        { width, height }
      )
      ctx.drawImage(
        canvas,
        0,
        canvas.height - height,
        width,
        height,
        0,
        0,
        width,
        height
      )
      image.last = key
      return true
    },
    dispose() {
      if (!p.images.delete(image)) return
      image.from.source = null
      image.to.source = null
      release(gl, image)
      if (p.images.size === 0) close(p)
    }
  }
}
