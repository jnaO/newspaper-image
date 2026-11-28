import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import {
  type Call,
  draws as countDraws,
  fakeCanvas,
  fakeGl,
  image,
  uniform as lastUniform,
  surface
} from '../../test/fakeGl.js'
import type { Printer } from './printer.js'
import { resolveSettings } from './settings.js'
import type { createSharedPrinter as Create } from './sharedPrinter.js'

const VIEW = {
  W: 100,
  H: 50,
  origin: [0, 0] as [number, number],
  dpr: 2
}
const STATE = { time: 0, fade: 0 }

let createSharedPrinter: typeof Create
let calls: Call[]
// Every offscreen canvas made through document.createElement, and
// every getContext('webgl2') asked of one.
let offscreens: ReturnType<typeof fakeCanvas>[]
let webgl2: number
let webgl2Available: boolean
// The next texImage2D throws, as for a tainted source.
let throwUpload: boolean
let printers: Printer[]

const offscreen = () => {
  const canvas = offscreens.at(-1)
  if (!canvas) throw new Error('no offscreen canvas')
  return canvas
}

beforeEach(async () => {
  vi.resetModules()
  ;({ createSharedPrinter } = await import(
    './sharedPrinter.js'
  ))
  calls = []
  offscreens = []
  webgl2 = 0
  webgl2Available = true
  throwUpload = false
  printers = []
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      expect(tag).toBe('canvas')
      const gl = fakeGl(calls, {
        getExtension: (name: string) =>
          name === 'WEBGL_lose_context'
            ? {
                loseContext: () =>
                  calls.push(['loseContext'])
              }
            : null,
        texImage2D: (...args: never[]) => {
          calls.push(['texImage2D', ...args])
          if (!throwUpload) return
          throwUpload = false
          throw new Error('tainted')
        }
      })
      const canvas = fakeCanvas(gl)
      canvas.width = 300
      canvas.height = 150
      canvas.getContext = () => {
        webgl2++
        return webgl2Available ? gl : null
      }
      offscreens.push(canvas)
      return canvas
    }
  })
})

afterEach(() => {
  for (const printer of printers) printer.dispose()
  vi.unstubAllGlobals()
})

// A 2D target canvas whose context records drawImage into `calls`.
const target = (width = 200, height = 100) => {
  const ctx = {
    drawImage: (...args: unknown[]) =>
      calls.push(['drawImage', ctx, ...args])
  }
  const canvas = fakeCanvas(ctx)
  canvas.width = width
  canvas.height = height
  return { canvas, ctx }
}

const make = (
  canvas = target().canvas,
  options?: Parameters<typeof Create>[1]
) => {
  const printer = createSharedPrinter(
    canvas as unknown as HTMLCanvasElement,
    options
  )
  if (!printer) throw new Error('no printer')
  printers.push(printer)
  return printer
}
const ready = (printer: Printer) => {
  printer.setFrom(image(200, 100))
  printer.setTo(surface(200, 100))
  return printer
}
const uploads = () =>
  calls.filter(([fn]) => fn === 'texImage2D').length
const draws = () => countDraws(calls)
const uniform = (name: string) => lastUniform(calls, name)
const copies = () =>
  calls.filter(([fn]) => fn === 'drawImage')

describe('createSharedPrinter', () => {
  it('prints any number of images through one webgl2 context', () => {
    make()
    make()
    const last = make()
    expect(webgl2).toBe(1)
    expect(offscreens).toHaveLength(1)
    for (const printer of printers) printer.dispose()
    expect(calls).toContainEqual(['loseContext'])
    printers = []
    last.dispose()
    make()
    expect(webgl2).toBe(2)
  })

  it('keeps the context until the last image is disposed', () => {
    const a = make()
    make()
    a.dispose()
    expect(calls).not.toContainEqual(['loseContext'])
  })

  it('is null for every call once WebGL2 is unavailable', () => {
    webgl2Available = false
    const canvas = target()
      .canvas as unknown as HTMLCanvasElement
    expect(createSharedPrinter(canvas)).toBeNull()
    expect(createSharedPrinter(canvas)).toBeNull()
    webgl2Available = true
    expect(createSharedPrinter(canvas)).toBeNull()
    expect(webgl2).toBe(1)
  })

  it('is null for a target without a 2D context', () => {
    const canvas = fakeCanvas(null)
    expect(
      createSharedPrinter(
        canvas as unknown as HTMLCanvasElement
      )
    ).toBeNull()
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

  it('uploads a source used by both sides once and shares its texture', () => {
    const printer = make()
    const photo = image(200, 100)
    printer.setFrom(photo)
    printer.setTo(photo, { fit: 'fill' })
    expect(uploads()).toBe(1)
    calls.length = 0
    printer.draw(VIEW, STATE)
    expect(
      calls.filter(([fn]) => fn === 'bindTexture')
    ).toEqual([
      ['bindTexture', 'TEXTURE_2D', { texture: 1 }],
      ['bindTexture', 'TEXTURE_2D', { texture: 1 }]
    ])
  })

  it('re-uploads a source set again on the same side', () => {
    const printer = make()
    const art = surface(200, 100)
    printer.setFrom(image(200, 100))
    printer.setTo(art)
    printer.draw(VIEW, STATE)
    calls.length = 0
    printer.setTo(art)
    expect(uploads()).toBe(1)
    expect(calls).toContainEqual([
      'deleteTexture',
      { texture: 2 }
    ])
    printer.draw(VIEW, STATE)
    expect(draws()).toBe(1)
  })

  it('deletes a texture no side uses any more', () => {
    const printer = make()
    printer.setFrom(image(200, 100))
    printer.setTo(surface(200, 100))
    calls.length = 0
    printer.setTo(surface(200, 100))
    expect(
      calls.filter(([fn]) => fn === 'deleteTexture')
    ).toEqual([['deleteTexture', { texture: 2 }]])
  })

  it('keeps a texture the other side still uses', () => {
    const printer = make()
    const photo = image(200, 100)
    printer.setFrom(photo)
    printer.setTo(photo)
    calls.length = 0
    printer.setTo(surface(200, 100))
    expect(
      calls.filter(([fn]) => fn === 'deleteTexture')
    ).toEqual([])
  })

  it('keeps an image as it was when its upload throws', () => {
    const printer = make()
    printer.setFrom(image(200, 100))
    printer.setTo(surface(200, 100), { fit: 'fill' })
    printer.draw(VIEW, STATE)
    calls.length = 0
    throwUpload = true
    expect(() =>
      printer.setTo(image(400, 100), { position: [1, 0.5] })
    ).toThrow('tainted')
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

  it('binds each image its own textures at every draw', () => {
    const a = ready(make())
    const b = ready(make())
    calls.length = 0
    a.draw(VIEW, STATE)
    b.draw(VIEW, STATE)
    expect(
      calls.filter(([fn]) => fn === 'bindTexture')
    ).toEqual([
      ['bindTexture', 'TEXTURE_2D', { texture: 1 }],
      ['bindTexture', 'TEXTURE_2D', { texture: 2 }],
      ['bindTexture', 'TEXTURE_2D', { texture: 3 }],
      ['bindTexture', 'TEXTURE_2D', { texture: 4 }]
    ])
  })

  it('applies settings only when they are not the last applied', () => {
    const nine = resolveSettings({ cell: 9 })
    const seven = resolveSettings({ cell: 7 })
    const a = ready(make(undefined, { settings: nine }))
    const b = ready(make(undefined, { settings: nine }))
    const c = ready(make(undefined, { settings: seven }))
    calls.length = 0
    const cells = () =>
      calls.filter(
        ([fn, loc]) =>
          fn === 'uniform1f' &&
          (loc as { name: string }).name === 'uCell'
      )
    a.draw(VIEW, STATE)
    expect(cells()).toEqual([
      ['uniform1f', { name: 'uCell' }, 9]
    ])
    b.draw(VIEW, STATE)
    expect(cells()).toHaveLength(1)
    c.draw(VIEW, STATE)
    expect(uniform('uCell')).toEqual([7])
    a.setSettings(seven)
    a.draw(VIEW, STATE)
    expect(cells()).toHaveLength(2)
    expect(draws()).toBe(4)
  })

  it('makes no GL call and no copy for a draw matching the last', () => {
    const a = ready(make())
    const b = ready(make())
    a.draw(VIEW, STATE)
    b.draw(VIEW, STATE)
    calls.length = 0
    expect(a.draw(VIEW, STATE)).toBe(true)
    expect(calls).toEqual([])
    a.setSettings(resolveSettings({ cell: 9 }))
    a.draw(VIEW, STATE)
    expect(draws()).toBe(1)
  })

  it('prints each image into the bottom-left of its own size', () => {
    const t = target(200, 100)
    const printer = ready(make(t.canvas))
    printer.draw(VIEW, STATE)
    expect(calls).toContainEqual([
      'viewport',
      0,
      0,
      200,
      100
    ])
    expect(uniform('uCanvas')).toEqual([200, 100])
    expect(copies()).toEqual([
      [
        'drawImage',
        t.ctx,
        offscreen(),
        0,
        50,
        200,
        100,
        0,
        0,
        200,
        100
      ]
    ])
  })

  it('copies each image right after its own draw', () => {
    const a = ready(make())
    const b = ready(make())
    calls.length = 0
    a.draw(VIEW, STATE)
    b.draw(VIEW, STATE)
    expect(
      calls
        .map(([fn]) => fn)
        .filter(
          (fn) => fn === 'drawArrays' || fn === 'drawImage'
        )
    ).toEqual([
      'drawArrays',
      'drawImage',
      'drawArrays',
      'drawImage'
    ])
  })

  it('only grows the offscreen canvas', () => {
    const big = target(400, 120)
    const small = target(100, 300)
    const a = ready(make(big.canvas))
    const b = ready(make(small.canvas))
    a.draw(VIEW, STATE)
    expect([offscreen().width, offscreen().height]).toEqual(
      [400, 150]
    )
    b.draw(VIEW, STATE)
    expect([offscreen().width, offscreen().height]).toEqual(
      [400, 300]
    )
    big.canvas.width = 200
    big.canvas.height = 100
    a.draw(VIEW, STATE)
    expect([offscreen().width, offscreen().height]).toEqual(
      [400, 300]
    )
    expect(copies().at(-1)).toEqual([
      'drawImage',
      big.ctx,
      offscreen(),
      0,
      200,
      200,
      100,
      0,
      0,
      200,
      100
    ])
  })
})
