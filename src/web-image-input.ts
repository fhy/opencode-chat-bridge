import type { WebAttachmentsConfig } from "./config"

export interface WebPromptImage {
  mimeType: string
  data: string
  width: number
  height: number
}

interface IncomingWebImage {
  mimeType?: unknown
  data?: unknown
}

function uint24LE(data: Buffer, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16)
}

function pngDimensions(data: Buffer): { width: number; height: number } | null {
  const signature = "89504e470d0a1a0a"
  if (data.length < 24 || data.subarray(0, 8).toString("hex") !== signature) return null
  if (data.subarray(12, 16).toString("ascii") !== "IHDR") return null
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}

function jpegDimensions(data: Buffer): { width: number; height: number } | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
  let offset = 2

  while (offset + 3 < data.length) {
    while (offset < data.length && data[offset] === 0xff) offset++
    if (offset >= data.length) return null
    const marker = data[offset++]
    if (marker === 0xd8 || marker === 0x01) continue
    if (marker === 0xd9 || marker === 0xda) return null
    if (offset + 2 > data.length) return null
    const length = data.readUInt16BE(offset)
    if (length < 2 || offset + length > data.length) return null
    if (sofMarkers.has(marker)) {
      if (length < 7) return null
      return {
        width: data.readUInt16BE(offset + 5),
        height: data.readUInt16BE(offset + 3),
      }
    }
    offset += length
  }
  return null
}

function webpDimensions(data: Buffer): { width: number; height: number } | null {
  if (
    data.length < 30 ||
    data.subarray(0, 4).toString("ascii") !== "RIFF" ||
    data.subarray(8, 12).toString("ascii") !== "WEBP"
  ) return null

  const chunk = data.subarray(12, 16).toString("ascii")
  if (chunk === "VP8X") {
    return {
      width: uint24LE(data, 24) + 1,
      height: uint24LE(data, 27) + 1,
    }
  }
  if (
    chunk === "VP8 " && data.length >= 30 &&
    data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a
  ) {
    return {
      width: data.readUInt16LE(26) & 0x3fff,
      height: data.readUInt16LE(28) & 0x3fff,
    }
  }
  if (chunk === "VP8L" && data.length >= 25 && data[20] === 0x2f) {
    const b1 = data[21]
    const b2 = data[22]
    const b3 = data[23]
    const b4 = data[24]
    return {
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | (b2 >> 6)),
    }
  }
  return null
}

function dimensionsForMime(data: Buffer, mimeType: string): { width: number; height: number } | null {
  if (mimeType === "image/png") return pngDimensions(data)
  if (mimeType === "image/jpeg") return jpegDimensions(data)
  if (mimeType === "image/webp") return webpDimensions(data)
  return null
}

function decodeBase64(data: string, maxBytes: number): Buffer {
  if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    throw new Error("Image data is not valid base64.")
  }
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0
  const decodedBytes = (data.length / 4) * 3 - padding
  if (decodedBytes > maxBytes) {
    throw new Error(`Image exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MiB limit.`)
  }
  const decoded = Buffer.from(data, "base64")
  if (decoded.length !== decodedBytes) throw new Error("Image data is not valid base64.")
  return decoded
}

export function validateWebPromptImages(
  input: unknown,
  config: WebAttachmentsConfig,
): WebPromptImage[] {
  if (input === undefined) return []
  if (!Array.isArray(input)) throw new Error("Invalid image attachment list.")
  if (input.length === 0) return []
  if (!config.enabled) throw new Error("Image attachments are disabled.")
  if (input.length > config.maxFilesPerMessage) {
    throw new Error(`A message may contain at most ${config.maxFilesPerMessage} image(s).`)
  }

  return input.map((raw: IncomingWebImage) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid image attachment.")
    if (typeof raw.mimeType !== "string" || !config.allowedMimeTypes.includes(raw.mimeType)) {
      throw new Error("Unsupported image type.")
    }
    if (typeof raw.data !== "string") throw new Error("Invalid image data.")

    const decoded = decodeBase64(raw.data, config.maxFileBytes)
    const dimensions = dimensionsForMime(decoded, raw.mimeType)
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
      throw new Error("Image content does not match its declared type.")
    }
    if (dimensions.width > config.maxWidth || dimensions.height > config.maxHeight) {
      throw new Error(`Image dimensions exceed ${config.maxWidth}x${config.maxHeight}.`)
    }
    if (dimensions.width * dimensions.height > config.maxPixels) {
      throw new Error(`Image exceeds the ${config.maxPixels.toLocaleString("en-US")} pixel limit.`)
    }

    return {
      mimeType: raw.mimeType,
      data: raw.data,
      width: dimensions.width,
      height: dimensions.height,
    }
  })
}
