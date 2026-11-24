import { describe, expect, it } from 'vitest'

import {
  lodBias,
  placeRect,
  sourceSize
} from './geometry.js'
import { DEFAULT_SETTINGS } from './settings.js'

const { soft } = DEFAULT_SETTINGS

describe('lodBias', () => {
  it('is the tone blur at one texel per CSS px', () => {
    expect(lodBias(1, soft)).toBe(soft)
  })

  it('adds a mip level per doubling of texel density', () => {
    expect(lodBias(2, soft)).toBeCloseTo(soft + 1)
    expect(lodBias(4, soft)).toBeCloseTo(soft + 2)
    expect(lodBias(0.5, soft)).toBeCloseTo(soft - 1)
  })
})

describe('placeRect', () => {
  const coverLeft = {
    fit: 'cover',
    position: [0, 0.5]
  } as const

  it('cover left: fills the height of a wide box, anchored left', () => {
    // 100×100 image, 200×100 viewport → scale 2, overflow height.
    expect(
      placeRect(100, 100, 200, 100, coverLeft)
    ).toEqual({
      x: 0,
      y: -50,
      width: 200,
      height: 200
    })
  })

  it('cover left: fills the height of a tall box, cropping the right', () => {
    expect(
      placeRect(100, 100, 100, 300, coverLeft)
    ).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 300
    })
  })

  it('defaults to cover, centred', () => {
    expect(placeRect(100, 100, 100, 300)).toEqual({
      x: -100,
      y: 0,
      width: 300,
      height: 300
    })
    expect(placeRect(100, 100, 200, 100, {})).toEqual({
      x: 0,
      y: -50,
      width: 200,
      height: 200
    })
  })

  it('positions the overflow like object-position percentages', () => {
    expect(
      placeRect(100, 100, 100, 300, { position: [1, 0] })
    ).toEqual({ x: -200, y: 0, width: 300, height: 300 })
    expect(
      placeRect(100, 100, 200, 100, { position: [0, 1] })
    ).toEqual({ x: 0, y: -100, width: 200, height: 200 })
  })

  it('fill stretches over the box', () => {
    expect(
      placeRect(100, 50, 300, 400, {
        fit: 'fill',
        position: [1, 1]
      })
    ).toEqual({ x: 0, y: 0, width: 300, height: 400 })
  })
})

describe('sourceSize', () => {
  it('reads an image element’s natural size', () => {
    expect(
      sourceSize({
        naturalWidth: 2400,
        naturalHeight: 1600,
        width: 300,
        height: 200
      } as unknown as TexImageSource)
    ).toEqual({ width: 2400, height: 1600 })
  })

  it('reads a video’s intrinsic size', () => {
    expect(
      sourceSize({
        videoWidth: 1920,
        videoHeight: 1080,
        width: 0,
        height: 0
      } as unknown as TexImageSource)
    ).toEqual({ width: 1920, height: 1080 })
  })

  it('reads a video frame’s display size', () => {
    expect(
      sourceSize({
        displayWidth: 640,
        displayHeight: 480,
        codedWidth: 656,
        codedHeight: 496
      } as unknown as TexImageSource)
    ).toEqual({ width: 640, height: 480 })
  })

  it('reads a canvas, bitmap or ImageData size', () => {
    expect(
      sourceSize({
        width: 800,
        height: 600
      } as unknown as TexImageSource)
    ).toEqual({ width: 800, height: 600 })
  })
})
