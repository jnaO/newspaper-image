// An image element once `src` has loaded. `crossOrigin` is set
// before `src`.
export function loadImage(
  src: string,
  crossOrigin?: string
) {
  return new Promise<HTMLImageElement>(
    (resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      if (crossOrigin !== undefined)
        img.crossOrigin = crossOrigin
      img.src = src
    }
  )
}
