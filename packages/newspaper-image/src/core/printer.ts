import {
  lodBias,
  type Placement,
  placeRect,
  type Rect,
  sourceSize
} from './geometry.js'
import {
  FRAGMENT_SHADER,
  VERTEX_SHADER
} from './printShader.js'
import {
  DEFAULT_SETTINGS,
  type PrintSettings,
  settingUniforms
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

const FROM_UNIT = 0
const TO_UNIT = 1

type Uniforms = Record<string, WebGLUniformLocation | null>

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    return shader
  console.error(gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
  return null
}

function link(gl: WebGL2RenderingContext) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = compile(
    gl,
    gl.FRAGMENT_SHADER,
    FRAGMENT_SHADER
  )
  const program = gl.createProgram()
  if (!vs || !fs || !program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (gl.getProgramParameter(program, gl.LINK_STATUS))
    return program
  console.error(gl.getProgramInfoLog(program))
  gl.deleteProgram(program)
  return null
}

function uniformsOf(
  gl: WebGL2RenderingContext,
  program: WebGLProgram
) {
  const uniforms: Uniforms = {}
  const count = gl.getProgramParameter(
    program,
    gl.ACTIVE_UNIFORMS
  )
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i)
    if (info)
      uniforms[info.name] = gl.getUniformLocation(
        program,
        info.name
      )
  }
  return uniforms
}

// Program, full-screen quad and texture units.
function build(gl: WebGL2RenderingContext) {
  const program = link(gl)
  if (!program) return null
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
  gl.useProgram(program)
  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  )
  const a = gl.getAttribLocation(program, 'a')
  gl.enableVertexAttribArray(a)
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)

  const u = uniformsOf(gl, program)
  gl.uniform1i(u.uMono, FROM_UNIT)
  gl.uniform1i(u.uPhoto, TO_UNIT)
  return { program, quad, u }
}

function applySettings(
  gl: WebGL2RenderingContext,
  u: Uniforms,
  settings: PrintSettings
) {
  for (const [name, value] of settingUniforms(settings)) {
    if (typeof value === 'number')
      gl.uniform1f(u[name], value)
    else gl.uniform3fv(u[name], value)
  }
}

function upload(
  gl: WebGL2RenderingContext,
  unit: number,
  source: TexImageSource,
  previous: WebGLTexture | null
) {
  if (previous) gl.deleteTexture(previous)
  const texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    source
  )
  gl.generateMipmap(gl.TEXTURE_2D)
  const param = (name: number, value: number) =>
    gl.texParameteri(gl.TEXTURE_2D, name, value)
  param(gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  param(gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  param(gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  param(gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return texture
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
    side.source = source
    side.placement = placement
    if (!lost) uploadSide(side, unit)
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

  // Where a side lands in the W×H view and its tone-blur mip level.
  const place = (
    source: TexImageSource,
    placement: Placement,
    W: number,
    H: number
  ) => {
    const size = sourceSize(source)
    const rect = placeRect(
      size.width,
      size.height,
      W,
      H,
      placement
    )
    const lod = lodBias(
      size.width / rect.width,
      settings.soft
    )
    return { rect, lod }
  }

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
    draw({ W, H, origin, dpr }, { time, fade, press = 1 }) {
      if (lost || !built || !from.source || !to.source)
        return false
      if (!from.texture || !to.texture) return false
      const { u } = built
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
      const mono = place(from.source, from.placement, W, H)
      const photo = place(to.source, to.placement, W, H)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(u.uOrigin, origin[0], origin[1])
      gl.uniform2f(u.uCanvas, canvas.width, canvas.height)
      gl.uniform2f(u.uView, W, H)
      gl.uniform1f(u.uDpr, dpr)
      const rect4 = (
        loc: WebGLUniformLocation | null,
        r: Rect
      ) => gl.uniform4f(loc, r.x, r.y, r.width, r.height)
      rect4(u.uMonoX, mono.rect)
      rect4(u.uPhotoX, photo.rect)
      gl.uniform1f(u.uMonoLod, mono.lod)
      gl.uniform1f(u.uPhotoLod, photo.lod)
      gl.uniform1f(u.uTime, time)
      gl.uniform1f(u.uFade, fade)
      gl.uniform1f(u.uPress, press)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
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
      if (built) {
        gl.deleteBuffer(built.quad)
        gl.deleteProgram(built.program)
      }
      built = null
      from.source = null
      to.source = null
    }
  }
}
