'use client'

import {
  type PrintSettings,
  resolveSettings,
  totalMs
} from 'newspaper-image/core'
import { useMemo, useRef, useState } from 'react'

import styles from './check.module.css'
import { PrintCanvas } from './PrintCanvas'
import {
  boxView,
  setupImages,
  setupSite,
  siteView
} from './scenes'

type Scene = 'site' | 'images'

type NumberKey = 'cell' | 'angle' | 'specks' | 'sweepMs'
type ColourKey = 'ink' | 'paper'
type SelectKey = 'mode'

const NUMBER_INPUTS: [NumberKey, number][] = [
  ['cell', 0.1],
  ['angle', 1],
  ['specks', 0.01],
  ['sweepMs', 10]
]
const COLOUR_INPUTS: ColourKey[] = ['ink', 'paper']
// Option labels, the value being the index.
const SELECT_INPUTS: [SelectKey, string[]][] = [
  ['mode', ['one ink', 'CMYK']]
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

  const canvas =
    scene === 'site' ? (
      <PrintCanvas
        key="site"
        className={styles.site}
        settings={settings}
        state={state}
        view={siteView}
        setup={setupSite}
        onUnavailable={() => setUnavailable(true)}
      />
    ) : (
      <PrintCanvas
        key="images"
        className={styles.images}
        settings={settings}
        state={state}
        view={boxView}
        setup={setupImages}
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
          {(['site', 'images'] as const).map((s) => (
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
