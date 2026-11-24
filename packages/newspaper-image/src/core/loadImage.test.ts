import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadImage } from './loadImage.js'

class FakeImage {
  static last: FakeImage
  log: string[] = []
  onload: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  constructor() {
    FakeImage.last = this
  }
  set crossOrigin(value: string) {
    this.log.push(`crossOrigin=${value}`)
  }
  set src(value: string) {
    this.log.push(`src=${value}`)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadImage', () => {
  it('resolves with the image once it loads', async () => {
    vi.stubGlobal('Image', FakeImage)
    const loading = loadImage('/a.jpg')
    const img = FakeImage.last
    img.onload?.()
    await expect(loading).resolves.toBe(img)
    expect(img.log).toEqual(['src=/a.jpg'])
  })

  it('rejects when the image fails', async () => {
    vi.stubGlobal('Image', FakeImage)
    const loading = loadImage('/a.jpg')
    FakeImage.last.onerror?.('boom')
    await expect(loading).rejects.toBe('boom')
  })

  it('sets crossOrigin before src', () => {
    vi.stubGlobal('Image', FakeImage)
    loadImage('https://x.test/a.jpg', 'anonymous')
    expect(FakeImage.last.log).toEqual([
      'crossOrigin=anonymous',
      'src=https://x.test/a.jpg'
    ])
  })
})
