import { describe, expect, it } from 'vitest'

import {
  clamp01,
  mirror,
  revealTime,
  totalMs
} from './clock.js'
import { DEFAULT_SETTINGS } from './settings.js'

const TOTAL_MS = totalMs(DEFAULT_SETTINGS)
const LEAVE_SPEED = 1.4

describe('totalMs', () => {
  it('is one sweep plus one print', () => {
    expect(TOTAL_MS).toBe(830)
  })

  it('follows the settings', () => {
    expect(
      totalMs({
        ...DEFAULT_SETTINGS,
        sweepMs: 100,
        printMs: 50
      })
    ).toBe(150)
  })

  it('runs one and a half sweeps plus the merge with settle', () => {
    expect(
      totalMs({
        ...DEFAULT_SETTINGS,
        sweepMs: 100,
        printMs: 50,
        mergeMs: 30,
        settle: 1
      })
    ).toBe(180)
  })
})

describe('mirror', () => {
  it('runs the clock from the other end', () => {
    expect(mirror(0, TOTAL_MS)).toBe(TOTAL_MS)
    expect(mirror(TOTAL_MS, TOTAL_MS)).toBe(0)
    expect(mirror(200, TOTAL_MS)).toBe(TOTAL_MS - 200)
  })
})

describe('revealTime', () => {
  const reveal = (
    from: number,
    forward: boolean,
    elapsed: number
  ) =>
    revealTime(
      from,
      forward,
      elapsed,
      TOTAL_MS,
      LEAVE_SPEED
    )

  it('enters colour at one ms of clock per ms', () => {
    expect(reveal(0, true, 100)).toBe(100)
    expect(reveal(0, true, TOTAL_MS)).toBe(TOTAL_MS)
  })

  it('leaves colour at LEAVE_SPEED', () => {
    expect(reveal(TOTAL_MS, false, 100)).toBeCloseTo(
      TOTAL_MS - 100 * LEAVE_SPEED
    )
    expect(
      reveal(TOTAL_MS, false, TOTAL_MS / LEAVE_SPEED)
    ).toBe(0)
  })

  it('stops at either end', () => {
    expect(reveal(0, true, TOTAL_MS * 2)).toBe(TOTAL_MS)
    expect(reveal(TOTAL_MS, false, TOTAL_MS)).toBe(0)
  })

  it('turns around from where a reveal was', () => {
    expect(reveal(300, false, 0)).toBe(300)
    expect(reveal(300, false, 100)).toBeCloseTo(
      300 - 100 * LEAVE_SPEED
    )
    expect(reveal(300, true, 100)).toBe(400)
  })

  it('holds before the first frame', () => {
    expect(reveal(300, true, -5)).toBe(300)
  })

  it('runs back at one ms per ms by default', () => {
    expect(revealTime(300, false, 100, TOTAL_MS)).toBe(200)
  })
})

describe('clamp01', () => {
  it('clamps to 0–1', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(0.25)).toBe(0.25)
    expect(clamp01(2)).toBe(1)
  })
})
