import type { Placement } from './geometry.js'
import {
  applySettings,
  build,
  disposePlate,
  drawPlate,
  FROM_UNIT,
  TO_UNIT,
  upload
} from './plate.js'
import {
  DEFAULT_SETTINGS,
  type PrintSettings
} from './settings.js'

// Where the canvas sits: the view (CSS px), the canvas's top-left in
// it and the device pixel ratio. The caller sizes the canvas backing
// store.
export interface PrintView {
  W: number
  H: number
  origin: [number, number]
  dpr: number
}

export interface PrintState {
  // The reveal clock, 0 ("from") → totalMs(settings) ("to").
  time: number
  // 0 printed → 1 clean photo.
  fade: number
  // 0 blank paper → 1 printed; 1 when left out.
  press?: number
}

export interface Printer {
  // The image the reveal starts from, placed in the view.
  setFrom(
    source: TexImageSource,
    placement?: Placement
  ): void
  // The image the reveal ends on, placed in the view.
  setTo(source: TexImageSource, placement?: Placement): void
  // A full settings object (see resolveSettings).
  setSettings(settings: PrintSettings): void
  // False when the context is lost or a source is missing. A draw
  // matching the last one, with no upload or settings change since,
  // leaves the canvas as it is.
  draw(view: PrintView, state: PrintState): boolean
  dispose(): void
}

export interface PrinterOptions {
  // Default DEFAULT_SETTINGS.
  settings?: PrintSettings
  preserveDrawingBuffer?: boolean
  onLost?: () => void
  // Fires once the restored context has its textures back.
  onRestore?: () => void
}

interface Side {
  source: TexImageSource | null
  placement: Placement
  texture: WebGLTexture | null
}

// The WebGL2 print plate on `canvas`, or null without WebGL2 or when
// the shader fails to build. The "from" image is uMono (unit 0), the
// "to" image uPhoto (unit 1).
export function createPrinter(
  canvas: HTMLCanvasElement,
  options: PrinterOptions = {}
): Printer | null {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer:
      options.preserveDrawingBuffer ?? false
  })
  if (!gl) return null
  let built = build(gl)
  if (!built) return null

  let settings = options.settings ?? DEFAULT_SETTINGS
  applySettings(gl, built.u, settings)

  const from: Side = {
    source: null,
    placement: {},
    texture: null
  }
  const to: Side = {
    source: null,
    placement: {},
    texture: null
  }
  let lost = false
  let last = ''

  const uploadSide = (side: Side, unit: number) => {
    last = ''
    if (side.source)
      side.texture = upload(
        gl,
        unit,
        side.source,
        side.texture
      )
  }
  const setSide = (
    side: Side,
    unit: number,
    source: TexImageSource,
    placement: Placement = {}
  ) => {
    if (!lost) {
      side.texture = upload(gl, unit, source, side.texture)
      last = ''
    }
    side.source = source
    side.placement = placement
  }

  const onLost = (event: Event) => {
    event.preventDefault()
    lost = true
    last = ''
    from.texture = null
    to.texture = null
    options.onLost?.()
  }
  const onRestored = () => {
    built = build(gl)
    if (!built) return
    applySettings(gl, built.u, settings)
    lost = false
    uploadSide(from, FROM_UNIT)
    uploadSide(to, TO_UNIT)
    options.onRestore?.()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener(
    'webglcontextrestored',
    onRestored
  )

  return {
    setFrom(source, placement) {
      setSide(from, FROM_UNIT, source, placement)
    },
    setTo(source, placement) {
      setSide(to, TO_UNIT, source, placement)
    },
    setSettings(next) {
      settings = next
      last = ''
      if (!lost && built)
        applySettings(gl, built.u, settings)
    },
    draw(view, state) {
      if (lost || !built || !from.source || !to.source)
        return false
      if (!from.texture || !to.texture) return false
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
        canvas.width,
        canvas.height
      ].join()
      if (key === last) return true
      last = key
      drawPlate(
        gl,
        built,
        {
          ...from,
          source: from.source,
          texture: from.texture
        },
        { ...to, source: to.source, texture: to.texture },
        settings,
        view,
        state,
        canvas
      )
      return true
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener(
        'webglcontextrestored',
        onRestored
      )
      gl.deleteTexture(from.texture)
      gl.deleteTexture(to.texture)
      if (built) disposePlate(gl, built)
      built = null
      from.source = null
      to.source = null
    }
  }
}
