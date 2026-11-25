'use client'

import {
  type PrintSettings,
  resolveSettings,
  totalMs
} from 'newspaper-image/core'
import { useMemo, useRef, useState } from 'react'

import styles from './check.module.css'
import {
  PrintCanvas,
  type PrintCanvasProps
} from './PrintCanvas'
import { PRESETS } from './presets'
import {
  boxView,
  setupImages,
  setupPrototype,
  setupSite,
  siteView
} from './scenes'

const SCENES = {
  site: {
    className: 'site',
    view: siteView,
    setup: setupSite
  },
  images: {
    className: 'images',
    view: boxView,
    setup: setupImages
  },
  prototype: {
    className: 'site',
    view: siteView,
    setup: setupPrototype
  }
} satisfies Record<
  string,
  Pick<PrintCanvasProps, 'className' | 'view' | 'setup'>
>
type Scene = keyof typeof SCENES

type NumberKey =
  | 'cell'
  | 'angle'
  | 'specks'
  | 'sweepMs'
  | 'mergeMs'
type ColourKey = 'ink' | 'paper'
type SelectKey = 'mode' | 'fadeStyle'

const NUMBER_INPUTS: [NumberKey, number][] = [
  ['cell', 0.1],
  ['angle', 1],
  ['specks', 0.01],
  ['sweepMs', 10],
  ['mergeMs', 10]
]
const COLOUR_INPUTS: ColourKey[] = ['ink', 'paper']
// Option labels, the value being the index.
const SELECT_INPUTS: [SelectKey, string[]][] = [
  ['mode', ['one ink', 'CMYK', 'light dots']],
  ['fadeStyle', ['dissolve', 'crossfade', 'refine', 'off']]
]

export function PrintCheck() {
  const [scene, setScene] = useState<Scene>('site')
  const [overrides, setOverrides] = useState<
    Partial<PrintSettings>
  >({})
  const settings = useMemo(
    () => resolveSettings(overrides),
    [overrides]
  )
  const total = totalMs(settings)
  const [time, setTime] = useState(0)
  const [fade, setFade] = useState(0)
  const [press, setPress] = useState(1)
  const state = useMemo(
    () => ({ time, fade, press }),
    [time, fade, press]
  )
  const [unavailable, setUnavailable] = useState(false)
  const playFrame = useRef(0)

  const play = () => {
    cancelAnimationFrame(playFrame.current)
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(now - t0, total)
      setTime(t)
      if (t < total)
        playFrame.current = requestAnimationFrame(tick)
    }
    playFrame.current = requestAnimationFrame(tick)
  }

  const override = <K extends keyof PrintSettings>(
    key: K,
    value: PrintSettings[K] | undefined
  ) => setOverrides((o) => ({ ...o, [key]: value }))

  const { className, view, setup } = SCENES[scene]
  const canvas = (
    <PrintCanvas
      key={scene}
      className={styles[className]}
      settings={settings}
      state={state}
      view={view}
      setup={setup}
      onUnavailable={() => setUnavailable(true)}
    />
  )

  return (
    <main className={styles.main}>
      {canvas}
      {unavailable && (
        <p className={styles.unavailable} role="alert">
          WebGL2 is unavailable, or the print shader failed
          to build: createPrinter returned null.
        </p>
      )}
      <details className={styles.panel} open>
        <summary>Print check</summary>
        <fieldset className={styles.row}>
          <legend>Scene</legend>
          {(Object.keys(SCENES) as Scene[]).map((s) => (
            <label key={s}>
              <input
                type="radio"
                name="scene"
                checked={scene === s}
                onChange={() => setScene(s)}
              />{' '}
              {s}
            </label>
          ))}
        </fieldset>
        <fieldset className={styles.presets}>
          <legend>Prototype presets</legend>
          {Object.entries(PRESETS).map(([name, preset]) => (
            <button
              key={name}
              type="button"
              onClick={() => setOverrides(preset)}
            >
              {name}
            </button>
          ))}
        </fieldset>
        <label className={styles.field}>
          <span>
            time {Math.round(Math.min(time, total))} /{' '}
            {total}
          </span>
          <input
            type="range"
            min={0}
            max={total}
            step={1}
            value={Math.min(time, total)}
            onChange={(e) => {
              cancelAnimationFrame(playFrame.current)
              setTime(e.target.valueAsNumber)
            }}
          />
        </label>
        <button type="button" onClick={play}>
          Play
        </button>
        <label className={styles.field}>
          <span>fade {fade.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={fade}
            onChange={(e) =>
              setFade(e.target.valueAsNumber)
            }
          />
        </label>
        <label className={styles.field}>
          <span>press {press.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={press}
            onChange={(e) =>
              setPress(e.target.valueAsNumber)
            }
          />
        </label>
        {SELECT_INPUTS.map(([key, labels]) => (
          <label key={key} className={styles.field}>
            <span>{key}</span>
            <select
              value={settings[key]}
              onChange={(e) =>
                override(
                  key,
                  Number(
                    e.target.value
                  ) as PrintSettings[SelectKey]
                )
              }
            >
              {labels.map((label, value) => (
                <option key={label} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {NUMBER_INPUTS.map(([key, step]) => (
          <label key={key} className={styles.field}>
            <span>{key}</span>
            <input
              type="number"
              step={step}
              value={settings[key]}
              onChange={(e) => {
                const v = e.target.valueAsNumber
                if (!Number.isNaN(v)) override(key, v)
              }}
            />
          </label>
        ))}
        <label className={styles.field}>
          <span>settle</span>
          <input
            type="checkbox"
            checked={settings.settle === 1}
            onChange={(e) =>
              override('settle', e.target.checked ? 1 : 0)
            }
          />
        </label>
        {COLOUR_INPUTS.map((key) => (
          <label key={key} className={styles.field}>
            <span>{key}</span>
            <input
              type="color"
              value={settings[key]}
              onChange={(e) =>
                override(key, e.target.value)
              }
            />
          </label>
        ))}
        <button
          type="button"
          onClick={() => setOverrides({})}
          disabled={Object.keys(overrides).length === 0}
        >
          Reset to DEFAULT_SETTINGS
        </button>
      </details>
    </main>
  )
}
