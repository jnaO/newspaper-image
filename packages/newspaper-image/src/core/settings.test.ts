import { describe, expect, it } from 'vitest'

import { FRAGMENT_SHADER } from './printShader.js'
import {
  DEFAULT_SETTINGS,
  hexToRgb,
  type PrintSettings,
  resolveSettings,
  settingUniforms
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

// The keys jnaose PRINT lacks, as the prototype preset "Your pick
// (CMYK)" sets them.
const PROTOTYPE_ADDITIONS = {
  mode: 1,
  specks: 0,
  fadeStyle: 0
}

describe('DEFAULT_SETTINGS', () => {
  it('equals the site print settings plus the prototype keys', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      ...JNAOSE_PRINT,
      ...PROTOTYPE_ADDITIONS
    })
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

describe('settingUniforms', () => {
  const declared = new Set(
    [...FRAGMENT_SHADER.matchAll(/^uniform \w+ ([^;]+);/gm)]
      .flatMap((m) => m[1].split(','))
      .map((name) => name.trim())
  )
  const changed = (key: keyof PrintSettings) => {
    const value = DEFAULT_SETTINGS[key]
    return {
      ...DEFAULT_SETTINGS,
      [key]:
        typeof value === 'number' ? value + 1 : '#123456'
    }
  }
  const differing = (
    a: PrintSettings,
    b: PrintSettings
  ) => {
    const before = new Map(settingUniforms(a))
    return settingUniforms(b)
      .filter(
        ([name, value]) =>
          JSON.stringify(before.get(name)) !==
          JSON.stringify(value)
      )
      .map(([name]) => name)
  }
  const keys = Object.keys(
    DEFAULT_SETTINGS
  ) as (keyof PrintSettings)[]

  it('maps every setting but soft to its own uniform', () => {
    const names = keys
      .filter((key) => key !== 'soft')
      .map((key) => {
        const diff = differing(
          DEFAULT_SETTINGS,
          changed(key)
        )
        expect(diff, key).toHaveLength(1)
        return diff[0]
      })
    expect(new Set(names).size).toBe(names.length)
  })

  it('leaves soft out', () => {
    expect(
      differing(DEFAULT_SETTINGS, changed('soft'))
    ).toEqual([])
  })

  it('names only uniforms the fragment shader declares', () => {
    expect(declared.size).toBeGreaterThan(0)
    for (const [name] of settingUniforms(DEFAULT_SETTINGS))
      expect(declared, name).toContain(name)
  })

  it('passes colours as 0–1 RGB', () => {
    expect(
      new Map(settingUniforms(DEFAULT_SETTINGS)).get('uInk')
    ).toEqual(hexToRgb(DEFAULT_SETTINGS.ink))
  })
})
