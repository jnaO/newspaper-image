import { beforeEach, describe, expect, it } from 'vitest'

import { createPrinter } from './printer.js'
import { FRAGMENT_SHADER } from './printShader.js'
import {
  DEFAULT_SETTINGS,
  resolveSettings
} from './settings.js'

const UNIFORMS = [
  ...FRAGMENT_SHADER.matchAll(/^uniform \w+ ([^;]+);/gm)
]
  .flatMap((m) => m[1].split(','))
  .map((name) => name.trim())

type Call = [string, ...unknown[]]

// A WebGL2 context that records every call. Constants are their own
// names; uniform locations are { name }.
function fakeGl(calls: Call[]) {
  const handlers: Record<
    string,
    (...args: never[]) => unknown
  > = {
    getShaderParameter: () => true,
    getProgramParameter: (_: unknown, pname: string) =>
      pname === 'ACTIVE_UNIFORMS' ? UNIFORMS.length : true,
    getActiveUniform: (_: unknown, i: number) => ({
      name: UNIFORMS[i]
    }),
    getUniformLocation: (_: unknown, name: string) => ({
      name
    }),
    getAttribLocation: () => 0,
    createShader: () => ({}),
    createProgram: () => ({}),
    createBuffer: () => ({}),
    createTexture: () => ({})
  }
  return new Proxy(
    {},
    {
      get(_, key) {
        if (typeof key !== 'string') return undefined
        if (key in handlers) return handlers[key]
        if (/^[A-Z0-9_]+$/.test(key)) return key
        return (...args: unknown[]) => {
          calls.push([key, ...args])
        }
      }
    }
  )
}

function fakeCanvas(gl: unknown) {
  const listeners = new Map<string, (e: Event) => void>()
  const canvas = {
    width: 200,
    height: 100,
    getContext: () => gl,
    addEventListener: (
      type: string,
      fn: (e: Event) => void
    ) => listeners.set(type, fn),
    removeEventListener: (type: string) =>
      listeners.delete(type),
    fire: (type: string) =>
      listeners.get(type)?.({
        preventDefault() {}
      } as Event)
  }
  return canvas
}

const image = (
  naturalWidth: number,
  naturalHeight: number
) => ({ naturalWidth, naturalHeight }) as HTMLImageElement
const surface = (width: number, height: number) =>
  ({ width, height }) as HTMLCanvasElement

const VIEW = {
  W: 100,
  H: 50,
  origin: [0, 0] as [number, number],
  dpr: 2
}
const STATE = { time: 0, fade: 0 }

let calls: Call[]
let canvas: ReturnType<typeof fakeCanvas>

beforeEach(() => {
  calls = []
  canvas = fakeCanvas(fakeGl(calls))
})

const make = (
  options?: Parameters<typeof createPrinter>[1]
) => {
  const printer = createPrinter(
    canvas as unknown as HTMLCanvasElement,
    options
  )
  if (!printer) throw new Error('no printer')
  return printer
}
const uniform = (name: string) =>
  calls
    .filter(
      ([fn, loc]) =>
        fn.startsWith('uniform') &&
        (loc as { name?: string } | null)?.name === name
    )
    .at(-1)
    ?.slice(2)
const draws = () =>
  calls.filter(([fn]) => fn === 'drawArrays').length

describe('createPrinter', () => {
  it('is null without WebGL2', () => {
    const none = fakeCanvas(null)
    expect(
      createPrinter(none as unknown as HTMLCanvasElement)
    ).toBeNull()
  })

  it('applies the default settings at build', () => {
    make()
    expect(uniform('uCell')).toEqual([
      DEFAULT_SETTINGS.cell
    ])
    expect(uniform('uSweep')).toEqual([
      DEFAULT_SETTINGS.sweepMs
    ])
  })

  it('applies the settings option at build', () => {
    make({ settings: resolveSettings({ cell: 7 }) })
    expect(uniform('uCell')).toEqual([7])
  })

  it('does not draw until both sides are set', () => {
    const printer = make()
    expect(printer.draw(VIEW, STATE)).toBe(false)
    printer.setFrom(image(200, 100))
    expect(printer.draw(VIEW, STATE)).toBe(false)
    printer.setTo(surface(200, 100))
    expect(printer.draw(VIEW, STATE)).toBe(true)
    expect(draws()).toBe(1)
  })

  it('places each side and sets its lod from soft', () => {
    const printer = make()
    printer.setFrom(image(400, 100), {
      fit: 'cover',
      position: [1, 0.5]
    })
    printer.setTo(surface(200, 100), { fit: 'fill' })
    printer.draw(VIEW, STATE)
    // 400×100 covering 100×50: scale 0.5 → 200×50, right-aligned.
    expect(uniform('uMonoX')).toEqual([-100, 0, 200, 50])
    expect(uniform('uMonoLod')).toEqual([
      DEFAULT_SETTINGS.soft + 1
    ])
    expect(uniform('uPhotoX')).toEqual([0, 0, 100, 50])
    expect(uniform('uPhotoLod')).toEqual([
      DEFAULT_SETTINGS.soft + 1
    ])
  })

  it('applies new settings live and redraws the same frame', () => {
    const printer = make()
    printer.setFrom(image(200, 100))
    printer.setTo(surface(200, 100), { fit: 'fill' })
    printer.draw(VIEW, STATE)
    printer.draw(VIEW, STATE)
    expect(draws()).toBe(1)
    printer.setSettings(
      resolveSettings({ cell: 9, soft: 0 })
    )
    expect(uniform('uCell')).toEqual([9])
    printer.draw(VIEW, STATE)
    expect(draws()).toBe(2)
    expect(uniform('uPhotoLod')).toEqual([1])
  })

  it('re-applies the current settings on restore', () => {
    const printer = make()
    printer.setFrom(image(200, 100))
    printer.setTo(surface(200, 100))
    canvas.fire('webglcontextlost')
    printer.setSettings(resolveSettings({ cell: 9 }))
    expect(printer.draw(VIEW, STATE)).toBe(false)
    calls.length = 0
    canvas.fire('webglcontextrestored')
    expect(uniform('uCell')).toEqual([9])
    expect(printer.draw(VIEW, STATE)).toBe(true)
  })
})
