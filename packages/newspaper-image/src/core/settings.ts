// The print settings, under the print-raster prototype's key names
// (jnaose prototypes/print-raster/index.html, "Copy settings").
export interface PrintSettings {
  // 0 one ink, 1 CMYK.
  mode: 0 | 1
  // #rrggbb
  ink: string
  // #rrggbb
  paper: string
  paperOpacity: number
  // Halftone cell size, CSS px.
  cell: number
  // Degrees.
  angle: number
  lo: number
  hi: number
  gamma: number
  gain: number
  // Tone blur in mip levels at one texel per CSS px.
  soft: number
  rough: number
  roughScale: number
  grain: number
  mottle: number
  specks: number
  misreg: number
  sweepMs: number
  printMs: number
  // 0 dissolve through the screen, 1 crossfade, 2 refine (the screen
  // shrinks towards the device pixel), 3 off.
  fadeStyle: 0 | 1 | 2 | 3
}

// jnaose src/components/Backdrop/print.ts PRINT at 5e8a66b, plus the
// keys it lacks as the prototype preset "Your pick (CMYK)" sets them.
export const DEFAULT_SETTINGS: Readonly<PrintSettings> =
  Object.freeze({
    mode: 1,
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
    specks: 0,
    misreg: 0.2,
    sweepMs: 370,
    printMs: 460,
    fadeStyle: 0
  })

// DEFAULT_SETTINGS overlaid with each part in turn. Undefined parts
// and undefined values are skipped.
export function resolveSettings(
  ...parts: (Partial<PrintSettings> | undefined)[]
): PrintSettings {
  const settings: Record<string, unknown> = {
    ...DEFAULT_SETTINGS
  }
  for (const part of parts) {
    if (!part) continue
    for (const [key, value] of Object.entries(part)) {
      if (value !== undefined) settings[key] = value
    }
  }
  return settings as unknown as PrintSettings
}

export const hexToRgb = (hex: string) =>
  [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255
  ) as [number, number, number]

export type UniformValue = number | [number, number, number]

// The fragment shader uniform for each setting but `soft`, which
// feeds lodBias at draw time.
export const settingUniforms = (
  s: PrintSettings
): [string, UniformValue][] => [
  ['uMode', s.mode],
  ['uInk', hexToRgb(s.ink)],
  ['uPaper', hexToRgb(s.paper)],
  ['uPaperOpacity', s.paperOpacity],
  ['uCell', s.cell],
  ['uAngle', s.angle],
  ['uLo', s.lo],
  ['uHi', s.hi],
  ['uGamma', s.gamma],
  ['uGain', s.gain],
  ['uRough', s.rough],
  ['uRoughScale', s.roughScale],
  ['uGrain', s.grain],
  ['uMottle', s.mottle],
  ['uSpecks', s.specks],
  ['uMisreg', s.misreg],
  ['uSweep', s.sweepMs],
  ['uPrint', s.printMs],
  ['uFadeStyle', s.fadeStyle]
]
