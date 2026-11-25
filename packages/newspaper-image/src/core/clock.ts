import type { PrintSettings } from './settings.js'

export const clamp01 = (t: number) =>
  Math.min(Math.max(t, 0), 1)

// The reveal clock's full run, in ms: `time` runs 0 ("from") →
// totalMs ("to"). With settle, one and a half sweeps plus the merge;
// otherwise one sweep plus one print.
export const totalMs = (settings: PrintSettings) =>
  settings.settle
    ? settings.sweepMs * 1.5 + settings.mergeMs
    : settings.sweepMs + settings.printMs

// The reveal clock `elapsed` ms after it set off from `from` towards
// `total` (forward) or towards 0 at `backSpeed` ms of clock per ms.
export const revealTime = (
  from: number,
  forward: boolean,
  elapsed: number,
  total: number,
  backSpeed = 1
) => {
  const run = Math.max(elapsed, 0)
  return forward
    ? Math.min(from + run, total)
    : Math.max(from - run * backSpeed, 0)
}

// The same clock seen from the other end.
export const mirror = (time: number, total: number) =>
  total - time
