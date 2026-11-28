import { FRAGMENT_SHADER } from '../src/core/printShader.js'

const UNIFORMS = [
  ...FRAGMENT_SHADER.matchAll(/^uniform \w+ ([^;]+);/gm)
]
  .flatMap((m) => m[1].split(','))
  .map((name) => name.trim())

export type Call = [string, ...unknown[]]

type Handlers = Record<
  string,
  (...args: never[]) => unknown
>

// A WebGL2 context that records every call. Constants are their own
// names; uniform locations are { name }; textures are { texture: n },
// numbered from 1 in creation order. `overrides` replace handlers by
// method name.
export function fakeGl(
  calls: Call[],
  overrides: Handlers = {}
) {
  let textures = 0
  const handlers: Handlers = {
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
    createTexture: () => ({ texture: ++textures }),
    ...overrides
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

// A canvas whose getContext returns `context` and whose event
// listeners `fire` calls.
export function fakeCanvas(context: unknown) {
  const listeners = new Map<string, (e: Event) => void>()
  const canvas = {
    width: 200,
    height: 100,
    getContext: () => context,
    addEventListener: (
      type: string,
      fn: (e: Event) => void
    ) => listeners.set(type, fn),
    removeEventListener: (type: string) =>
      listeners.delete(type),
    listening: (type: string) => listeners.has(type),
    fire: (type: string) =>
      listeners.get(type)?.({
        preventDefault() {}
      } as Event)
  }
  return canvas
}

export const image = (
  naturalWidth: number,
  naturalHeight: number
) => ({ naturalWidth, naturalHeight }) as HTMLImageElement
export const surface = (width: number, height: number) =>
  ({ width, height }) as HTMLCanvasElement

// The arguments of the last uniform* call on `name`.
export const uniform = (calls: Call[], name: string) =>
  calls
    .filter(
      ([fn, loc]) =>
        fn.startsWith('uniform') &&
        (loc as { name?: string } | null)?.name === name
    )
    .at(-1)
    ?.slice(2)

export const draws = (calls: Call[]) =>
  calls.filter(([fn]) => fn === 'drawArrays').length
