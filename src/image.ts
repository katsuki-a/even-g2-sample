export const G2_IMAGE_WIDTH = 200
export const G2_IMAGE_HEIGHT = 100

export type ProcessedImage = {
  bmp: number[]
  preview: ImageData
}

export type ImageOptions = {
  threshold: number
  invert: boolean
}

function createMonochromeBmp(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const rowStride = Math.ceil(width / 32) * 4
  const pixelDataOffset = 62
  const pixelDataSize = rowStride * height
  const buffer = new ArrayBuffer(pixelDataOffset + pixelDataSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  view.setUint8(0, 0x42)
  view.setUint8(1, 0x4d)
  view.setUint32(2, bytes.length, true)
  view.setUint32(10, pixelDataOffset, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 1, true)
  view.setUint32(34, pixelDataSize, true)
  view.setInt32(38, 2835, true)
  view.setInt32(42, 2835, true)
  view.setUint32(46, 2, true)
  view.setUint32(54, 0x00000000, true)
  view.setUint32(58, 0x00ffffff, true)

  for (let y = 0; y < height; y += 1) {
    const sourceRow = height - 1 - y
    const rowOffset = pixelDataOffset + y * rowStride
    for (let x = 0; x < width; x += 1) {
      if (pixels[sourceRow * width + x] === 1) {
        bytes[rowOffset + Math.floor(x / 8)] |= 1 << (7 - (x % 8))
      }
    }
  }

  return bytes
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('画像を読み込めませんでした'))
    }
    image.src = url
  })
}

export async function processImage(file: File, options: ImageOptions): Promise<ProcessedImage> {
  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = G2_IMAGE_WIDTH
  canvas.height = G2_IMAGE_HEIGHT
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('画像変換を開始できませんでした')

  const scale = Math.min(G2_IMAGE_WIDTH / image.naturalWidth, G2_IMAGE_HEIGHT / image.naturalHeight)
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const x = Math.floor((G2_IMAGE_WIDTH - width) / 2)
  const y = Math.floor((G2_IMAGE_HEIGHT - height) / 2)

  context.fillStyle = '#fff'
  context.fillRect(0, 0, G2_IMAGE_WIDTH, G2_IMAGE_HEIGHT)
  context.drawImage(image, x, y, width, height)

  const imageData = context.getImageData(0, 0, G2_IMAGE_WIDTH, G2_IMAGE_HEIGHT)
  const pixels = new Uint8Array(G2_IMAGE_WIDTH * G2_IMAGE_HEIGHT)

  for (let index = 0; index < imageData.data.length; index += 4) {
    const luminance =
      0.299 * imageData.data[index] +
      0.587 * imageData.data[index + 1] +
      0.114 * imageData.data[index + 2]
    let isWhite = luminance >= options.threshold
    if (options.invert) isWhite = !isWhite
    const value = isWhite ? 255 : 0
    pixels[index / 4] = isWhite ? 1 : 0
    imageData.data[index] = value
    imageData.data[index + 1] = value
    imageData.data[index + 2] = value
    imageData.data[index + 3] = 255
  }

  return {
    bmp: Array.from(createMonochromeBmp(pixels, G2_IMAGE_WIDTH, G2_IMAGE_HEIGHT)),
    preview: imageData,
  }
}
