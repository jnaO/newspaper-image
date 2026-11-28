import { beforeEach, describe, expect, it } from 'vitest'

import {
  type Call,
  draws as countDraws,
  fakeCanvas,
  fakeGl,
  image,
  uniform as lastUniform,
  surface
} from '../../test/fakeGl.js'
import { createPrinter } from './printer.js'
import {
  DEFAULT_SETTINGS,
  resolveSettings
} from './settings.js'

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
const uniform = (name: string) => lastUniform(calls, name)
const draws = () => countDraws(calls)

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
    // The light-dots tone sample: 3 levels at one texel per CSS px.
    expect(uniform('uDotLod')).toEqual([3 + 1])
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

  it('prints at the canvas backing size', () => {
    const printer = make()
    printer.setFrom(image(200, 100))
    printer.setTo(surface(200, 100))
    printer.draw(VIEW, STATE)
    expect(calls).toContainEqual([
      'viewport',
      0,
      0,
      200,
      100
    ])
    expect(uniform('uCanvas')).toEqual([200, 100])
  })

  it('binds "from" to unit 0 and "to" to unit 1 at every draw', () => {
    const printer = make()
    printer.setFrom(image(200, 100))
    printer.setTo(surface(200, 100))
    calls.length = 0
    printer.draw(VIEW, STATE)
    const binds = calls
      .slice(
        0,
        calls.findIndex(([fn]) => fn === 'drawArrays')
      )
      .filter(([fn]) =>
        ['activeTexture', 'bindTexture'].includes(fn)
      )
    expect(binds).toEqual([
      ['activeTexture', 'TEXTURE00'],
      ['bindTexture', 'TEXTURE_2D', { texture: 1 }],
      ['activeTexture', 'TEXTURE01'],
      ['bindTexture', 'TEXTURE_2D', { texture: 2 }]
    ])
  })

  it('keeps a side as it was when its upload throws', () => {
    let throwNext = false
    calls = []
    canvas = fakeCanvas(
      fakeGl(calls, {
        texImage2D: () => {
          if (throwNext) {
            throwNext = false
            throw new Error('tainted')
          }
        }
      })
    )
    const printer = make()
    printer.setFrom(image(200, 100))
    printer.setTo(surface(200, 100), { fit: 'fill' })
    printer.draw(VIEW, STATE)
    calls.length = 0
    throwNext = true
    expect(() =>
      printer.setTo(image(400, 100), {
        fit: 'cover',
        position: [1, 0.5]
      })
    ).toThrow('tainted')
    // Only the texture made for the failed upload is deleted.
    expect(
      calls.filter(([fn]) => fn === 'deleteTexture')
    ).toEqual([['deleteTexture', { texture: 3 }]])
    expect(printer.draw({ ...VIEW, W: 50 }, STATE)).toBe(
      true
    )
    expect(uniform('uPhotoX')).toEqual([0, 0, 50, 50])
    expect(calls).toContainEqual([
      'bindTexture',
      'TEXTURE_2D',
      { texture: 2 }
    ])
  })
})
