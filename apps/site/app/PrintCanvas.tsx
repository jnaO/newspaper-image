'use client'

import {
  createPrinter,
  type Printer,
  type PrintSettings,
  type PrintState,
  type PrintView,
  type SharedPrinterOptions
} from 'newspaper-image/core'
import { useEffect, useRef } from 'react'

export interface PrintCanvasProps {
  className: string
  settings: PrintSettings
  state: PrintState
  // The view to print into, read at every draw.
  view: (canvas: HTMLCanvasElement) => PrintView
  // Hands the printer its sources; returns the cleanup.
  setup: (
    printer: Printer,
    redraw: () => void
  ) => () => void
  onUnavailable: () => void
  // Read once, at mount. Default createPrinter.
  create?: (
    canvas: HTMLCanvasElement,
    options: SharedPrinterOptions
  ) => Printer | null
}

// A canvas printed by the printer `create` makes, redrawn on resize and
// whenever `settings` or `state` change. The backing store is
// Math.round(W * dpr) × Math.round(H * dpr).
export function PrintCanvas({
  className,
  settings,
  state,
  view,
  setup,
  onUnavailable,
  create = createPrinter
}: PrintCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const printerRef = useRef<Printer | null>(null)
  const latest = useRef({ settings, state, view })
  latest.current = { settings, state, view }
  const redrawRef = useRef(() => {})

  // biome-ignore lint/correctness/useExhaustiveDependencies: mounts once; later props arrive through `latest`
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const redraw = () => {
      const printer = printerRef.current
      if (!printer) return
      const v = latest.current.view(canvas)
      const cw = Math.round(v.W * v.dpr)
      const ch = Math.round(v.H * v.dpr)
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }
      printer.draw(v, latest.current.state)
    }
    const printer = create(canvas, {
      settings: latest.current.settings,
      onRestore: redraw
    })
    if (!printer) {
      onUnavailable()
      return
    }
    printerRef.current = printer
    redrawRef.current = redraw
    const stop = setup(printer, redraw)
    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(redraw)
    }
    window.addEventListener('resize', onResize)
    redraw()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      stop()
      printer.dispose()
      printerRef.current = null
      redrawRef.current = () => {}
    }
  }, [])

  useEffect(() => {
    printerRef.current?.setSettings(settings)
    redrawRef.current()
  }, [settings])

  // biome-ignore lint/correctness/useExhaustiveDependencies: state is read through `latest`
  useEffect(() => {
    redrawRef.current()
  }, [state])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="Newspaper print"
    />
  )
}
