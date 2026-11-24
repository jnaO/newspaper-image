import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SETTINGS,
  hexToRgb,
  resolveSettings
} from './settings.js'

// jnaose src/components/Backdrop/print.ts PRINT at 5e8a66b.
const JNAOSE_PRINT = {
  ink: '#161616',
  paper: '#efeadf',
  paperOpacity: 1,
  cell: 3.1,
  angle: 45,
  lo: 0.02,
  hi: 0.72,
  gamma: 1.12,
  gain: 0.08,
  soft: 1.2,
  rough: 0.35,
  roughScale: 1.4,
  grain: 0.1,
  mottle: 0.04,
  misreg: 0.2,
  sweepMs: 370,
  printMs: 460
}

describe('DEFAULT_SETTINGS', () => {
  it('equals the site print settings', () => {
    expect(DEFAULT_SETTINGS).toEqual(JNAOSE_PRINT)
  })

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true)
  })
})

describe('resolveSettings', () => {
  it('is the defaults with no parts', () => {
    expect(resolveSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('merges parts over the defaults, later parts winning', () => {
    expect(
      resolveSettings(
        { cell: 4, ink: '#000000' },
        { cell: 5 }
      )
    ).toEqual({
      ...DEFAULT_SETTINGS,
      cell: 5,
      ink: '#000000'
    })
  })

  it('skips undefined parts and undefined values', () => {
    expect(
      resolveSettings({ cell: 4 }, undefined, {
        cell: undefined,
        angle: undefined
      })
    ).toEqual({ ...DEFAULT_SETTINGS, cell: 4 })
  })

  it('leaves the defaults untouched', () => {
    resolveSettings({ cell: 9 })
    expect(DEFAULT_SETTINGS.cell).toBe(3.1)
  })
})

describe('hexToRgb', () => {
  it('maps #rrggbb to 0–1 channels', () => {
    expect(hexToRgb('#ff0080')).toEqual([1, 0, 128 / 255])
    expect(hexToRgb('#efeadf')).toEqual([
      0xef / 255,
      0xea / 255,
      0xdf / 255
    ])
  })
})
