import { describe, expect, test } from "bun:test"
import type { WebAttachmentsConfig } from "../../src/config"
import { validateWebPromptImages } from "../../src/web-image-input"

const config: WebAttachmentsConfig = {
  enabled: true,
  maxFileBytes: 1024,
  maxFilesPerMessage: 1,
  maxWidth: 4096,
  maxHeight: 4096,
  maxPixels: 20_000_000,
  resizeMaxDimension: 2048,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
}

const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1ZsAAAAASUVORK5CYII="

describe("Web image input validation", () => {
  test("accepts an allowed image with matching magic bytes and safe dimensions", () => {
    expect(validateWebPromptImages([
      { mimeType: "image/png", data: onePixelPng },
    ], config)).toEqual([{
      mimeType: "image/png",
      data: onePixelPng,
      width: 1,
      height: 1,
    }])
  })

  test("reads JPEG and WebP dimensions from their binary headers", () => {
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08,
      0x00, 0x03, 0x00, 0x02,
      0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
      0xff, 0xd9,
    ]).toString("base64")
    const webp = Buffer.alloc(30)
    webp.write("RIFF", 0)
    webp.writeUInt32LE(22, 4)
    webp.write("WEBPVP8X", 8)
    webp.writeUInt32LE(10, 16)
    webp[24] = 3
    webp[27] = 4

    expect(validateWebPromptImages([{ mimeType: "image/jpeg", data: jpeg }], config)[0])
      .toMatchObject({ width: 2, height: 3 })
    expect(validateWebPromptImages([{ mimeType: "image/webp", data: webp.toString("base64") }], config)[0])
      .toMatchObject({ width: 4, height: 5 })
  })

  test("allows ordinary text messages to send an empty image list while disabled", () => {
    expect(validateWebPromptImages([], { ...config, enabled: false })).toEqual([])
  })

  test("rejects image data when attachments are disabled", () => {
    expect(() => validateWebPromptImages([
      { mimeType: "image/png", data: onePixelPng },
    ], { ...config, enabled: false })).toThrow("Image attachments are disabled")
  })

  test("rejects unsupported and mismatched MIME types", () => {
    expect(() => validateWebPromptImages([
      { mimeType: "image/svg+xml", data: onePixelPng },
    ], config)).toThrow("Unsupported image type")
    expect(() => validateWebPromptImages([
      { mimeType: "image/jpeg", data: onePixelPng },
    ], config)).toThrow("does not match")
  })

  test("rejects invalid base64 and decoded payloads over the byte limit", () => {
    expect(() => validateWebPromptImages([
      { mimeType: "image/png", data: "not-base64" },
    ], config)).toThrow("valid base64")
    expect(() => validateWebPromptImages([
      { mimeType: "image/png", data: Buffer.alloc(1025).toString("base64") },
    ], config)).toThrow("MiB limit")
  })

  test("rejects excessive dimensions before forwarding to ACP", () => {
    const png = Buffer.from(onePixelPng, "base64")
    png.writeUInt32BE(5000, 16)
    expect(() => validateWebPromptImages([
      { mimeType: "image/png", data: png.toString("base64") },
    ], config)).toThrow("dimensions exceed")
  })

  test("enforces the per-message image count", () => {
    expect(() => validateWebPromptImages([
      { mimeType: "image/png", data: onePixelPng },
      { mimeType: "image/png", data: onePixelPng },
    ], config)).toThrow("at most 1 image")
  })
})
