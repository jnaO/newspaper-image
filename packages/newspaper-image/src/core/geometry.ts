// Mip level that blurs the tone as `soft` does at one texel per CSS
// px.
export const lodBias = (
  texelsPerCssPx: number,
  soft: number
) => soft + Math.log2(texelsPerCssPx)

// cover: scaled to cover the box, aspect kept. fill: stretched to
// the box.
export type Fit = 'cover' | 'fill'

export interface Placement {
  // Default 'cover'.
  fit?: Fit
  // Where the overflow sits, 0–1 per axis like CSS object-position
  // percentages. Default [0.5, 0.5].
  position?: [number, number]
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// Where an iw×ih source lands in a W×H box.
export function placeRect(
  iw: number,
  ih: number,
  W: number,
  H: number,
  { fit = 'cover', position = [0.5, 0.5] }: Placement = {}
): Rect {
  if (fit === 'fill')
    return { x: 0, y: 0, width: W, height: H }
  const scale = Math.max(W / iw, H / ih)
  const width = iw * scale
  const height = ih * scale
  // `|| 0` turns -0 into 0.
  return {
    x: (W - width) * position[0] || 0,
    y: (H - height) * position[1] || 0,
    width,
    height
  }
}

// A texture source's intrinsic size: naturalWidth for images,
// videoWidth for videos, displayWidth for video frames, else width.
export function sourceSize(source: TexImageSource) {
  if ('naturalWidth' in source)
    return {
      width: source.naturalWidth,
      height: source.naturalHeight
    }
  if ('videoWidth' in source)
    return {
      width: source.videoWidth,
      height: source.videoHeight
    }
  if ('displayWidth' in source)
    return {
      width: source.displayWidth,
      height: source.displayHeight
    }
  return { width: source.width, height: source.height }
}
