import type { PrintSettings } from 'newspaper-image/core'

// The PRESETS of jnaose prototypes/print-raster/index.html at 5e8a66b,
// verbatim.
// biome-ignore format: kept in the prototype's layout
export const PRESETS: Record<string, Partial<PrintSettings>> = {
  'Your pick (CMYK)': {
    mode: 1, ink: '#161616', paper: '#efeadf', paperOpacity: 1, cell: 3.1, angle: 45,
    lo: 0.02, hi: 0.72, gamma: 1.12, gain: 0.08, soft: 1.2, rough: 0.35, roughScale: 1.4,
    grain: 0.1, mottle: 0.04, specks: 0, misreg: 0.2, settle: 0,
    sweepMs: 370, printMs: 460, mergeMs: 440
  },
  'Reference (navy)': {
    mode: 0, ink: '#1c2756', paper: '#a7b4e4', paperOpacity: 1, cell: 3.2, angle: 45,
    lo: 0.04, hi: 0.92, gamma: 1.1, gain: 0.12, soft: 1.2, rough: 0.35, roughScale: 1,
    grain: 0.35, mottle: 0.35, specks: 0.35, misreg: 0, settle: 0
  },
  'Black on newsprint': {
    mode: 0, ink: '#161616', paper: '#e8e2d4', paperOpacity: 1, cell: 3.6, angle: 45,
    lo: 0.04, hi: 0.95, gamma: 1, gain: 0.15, soft: 1.2, rough: 0.3, roughScale: 1,
    grain: 0.3, mottle: 0.25, specks: 0.25, misreg: 0, settle: 0
  },
  'CMYK newsprint': {
    mode: 1, ink: '#161616', paper: '#efeadf', paperOpacity: 1, cell: 3.6, angle: 45,
    lo: 0.02, hi: 0.98, gamma: 1, gain: 0.1, soft: 1.2, rough: 0.25, roughScale: 1,
    grain: 0.25, mottle: 0.2, specks: 0.2, misreg: 0.6, settle: 0
  },
  'Ink only, no paper': {
    mode: 0, ink: '#0b1030', paper: '#a7b4e4', paperOpacity: 0, cell: 3.4, angle: 45,
    lo: 0.04, hi: 0.92, gamma: 1.1, gain: 0.12, soft: 1.2, rough: 0.35, roughScale: 1,
    grain: 0, mottle: 0.3, specks: 0.2, misreg: 0, settle: 0
  },
  'Current site effect': {
    mode: 2, ink: '#000000', paper: '#000000', paperOpacity: 0, cell: 5.5, angle: 45,
    lo: 0, hi: 1, gamma: 1, gain: 0, soft: 0, rough: 0, roughScale: 1,
    grain: 0, mottle: 0, specks: 0, misreg: 0, settle: 1
  }
}
