import {
  lodBias,
  type Placement,
  placeRect,
  type Rect,
  sourceSize
} from './geometry.js'
import type { PrintState, PrintView } from './printer.js'
import {
  FRAGMENT_SHADER,
  VERTEX_SHADER
} from './printShader.js'
import {
  type PrintSettings,
  settingUniforms
} from './settings.js'

// The printers' GL work: program, settings, uploads and the draw. Not
// exported from the barrel.

// The prototype's light-dots dot-size sample LOD, at one texel per
// CSS px.
const DOT_LOD = 3

export const FROM_UNIT = 0
export const TO_UNIT = 1

type Uniforms = Record<string, WebGLUniformLocation | null>

export type Plate = NonNullable<ReturnType<typeof build>>

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
export function build(gl: WebGL2RenderingContext) {
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

export function applySettings(
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

// A new mipmapped texture holding `source`, left bound to `unit`.
// `previous` is deleted once the upload succeeds; a throwing upload
// deletes only the new texture and rethrows.
export function upload(
  gl: WebGL2RenderingContext,
  unit: number,
  source: TexImageSource,
  previous: WebGLTexture | null
) {
  const texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  try {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source
    )
  } catch (error) {
    gl.deleteTexture(texture)
    throw error
  }
  gl.generateMipmap(gl.TEXTURE_2D)
  const param = (name: number, value: number) =>
    gl.texParameteri(gl.TEXTURE_2D, name, value)
  param(gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  param(gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  param(gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  param(gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  if (previous) gl.deleteTexture(previous)
  return texture
}

export function disposePlate(
  gl: WebGL2RenderingContext,
  plate: Plate
) {
  gl.deleteBuffer(plate.quad)
  gl.deleteProgram(plate.program)
}

export interface PlateSide {
  source: TexImageSource
  placement: Placement
  texture: WebGLTexture
}

// Where a side lands in the W×H view, its tone-blur mip level and
// its light-dots dot-size mip level.
function place(
  { source, placement }: PlateSide,
  W: number,
  H: number,
  soft: number
) {
  const size = sourceSize(source)
  const rect = placeRect(
    size.width,
    size.height,
    W,
    H,
    placement
  )
  const lod = lodBias(size.width / rect.width, soft)
  const dotLod = lodBias(size.width / rect.width, DOT_LOD)
  return { rect, lod, dotLod }
}

// Binds "from" to unit 0 and "to" to unit 1, then prints into the
// bottom-left `size` region of the drawing buffer.
export function drawPlate(
  gl: WebGL2RenderingContext,
  { u }: Plate,
  from: PlateSide,
  to: PlateSide,
  settings: PrintSettings,
  { W, H, origin, dpr }: PrintView,
  { time, fade, press = 1 }: PrintState,
  size: { width: number; height: number }
) {
  gl.activeTexture(gl.TEXTURE0 + FROM_UNIT)
  gl.bindTexture(gl.TEXTURE_2D, from.texture)
  gl.activeTexture(gl.TEXTURE0 + TO_UNIT)
  gl.bindTexture(gl.TEXTURE_2D, to.texture)
  const mono = place(from, W, H, settings.soft)
  const photo = place(to, W, H, settings.soft)
  gl.viewport(0, 0, size.width, size.height)
  gl.uniform2f(u.uOrigin, origin[0], origin[1])
  gl.uniform2f(u.uCanvas, size.width, size.height)
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
  gl.uniform1f(u.uDotLod, photo.dotLod)
  gl.uniform1f(u.uTime, time)
  gl.uniform1f(u.uFade, fade)
  gl.uniform1f(u.uPress, press)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}
