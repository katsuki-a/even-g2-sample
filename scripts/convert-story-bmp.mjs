import fs from 'node:fs'
import path from 'node:path'

const [, , inputPath, outputPath] = process.argv
if (!inputPath || !outputPath) throw new Error('Usage: node scripts/convert-story-bmp.mjs input.bmp output.bmp')

const input = fs.readFileSync(inputPath)
const source = new DataView(input.buffer, input.byteOffset, input.byteLength)
const pixelOffset = source.getUint32(10, true)
const width = source.getInt32(18, true)
const signedHeight = source.getInt32(22, true)
const height = Math.abs(signedHeight)
const bitsPerPixel = source.getUint16(28, true)
if (width !== 200 || height !== 100) throw new Error(`Expected 200x100 input, received ${width}x${height}`)
if (bitsPerPixel !== 24 && bitsPerPixel !== 32) throw new Error(`Unsupported input depth: ${bitsPerPixel}`)

const sourceStride = Math.ceil((width * bitsPerPixel) / 32) * 4
const monoStride = Math.ceil(width / 32) * 4
const outputOffset = 62
const output = Buffer.alloc(outputOffset + monoStride * height)
const target = new DataView(output.buffer, output.byteOffset, output.byteLength)

output.write('BM', 0, 2, 'ascii')
target.setUint32(2, output.length, true)
target.setUint32(10, outputOffset, true)
target.setUint32(14, 40, true)
target.setInt32(18, width, true)
target.setInt32(22, height, true)
target.setUint16(26, 1, true)
target.setUint16(28, 1, true)
target.setUint32(34, monoStride * height, true)
target.setInt32(38, 2835, true)
target.setInt32(42, 2835, true)
target.setUint32(46, 2, true)
target.setUint32(54, 0x00000000, true)
target.setUint32(58, 0x00ffffff, true)

for (let y = 0; y < height; y += 1) {
  const sourceY = signedHeight > 0 ? height - 1 - y : y
  const outputY = height - 1 - y
  for (let x = 0; x < width; x += 1) {
    const inputIndex = pixelOffset + sourceY * sourceStride + x * (bitsPerPixel / 8)
    const blue = input[inputIndex]
    const green = input[inputIndex + 1]
    const red = input[inputIndex + 2]
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114
    const threshold = 142 + ((x & 1) ^ (y & 1)) * 18
    if (luminance >= threshold) {
      const outputIndex = outputOffset + outputY * monoStride + Math.floor(x / 8)
      output[outputIndex] |= 1 << (7 - (x % 8))
    }
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, output)
