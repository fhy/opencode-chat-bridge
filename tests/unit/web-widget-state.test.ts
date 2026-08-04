import { describe, expect, test } from "bun:test"
import "../../connectors/web-widget-state.js"

type WidgetStateHelpers = {
  shouldClearHistory(event: {
    type?: string
    state?: string
    hasSession?: boolean
  } | null): boolean
  imageDimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } | null
  safeThumbnailDataUrl(value: unknown, maxChars: number): boolean
  thumbnailKeysToEvict(
    entries: Array<{ key: string; size: number; createdAt: number }>,
    maxTotalChars: number,
  ): string[]
  positiveTimeout(value: unknown, fallback: number): number
}

const helpers = (globalThis as typeof globalThis & {
  OpenCodeWidgetState: WidgetStateHelpers
}).OpenCodeWidgetState

describe("Web widget connection state", () => {
  test("preserves history for a new connection after a bridge restart", () => {
    expect(helpers.shouldClearHistory({
      type: "connected",
      state: "new",
      hasSession: false,
    })).toBe(false)
  })

  test("preserves history when a persisted session resumes", () => {
    expect(helpers.shouldClearHistory({
      type: "connected",
      state: "resumed",
      hasSession: true,
    })).toBe(false)
  })

  test("preserves history when the backend is unavailable", () => {
    expect(helpers.shouldClearHistory({
      type: "connected",
      state: "backend-unavailable",
      hasSession: false,
    })).toBe(false)
  })

  test("preserves history when a backend session is invalidated", () => {
    expect(helpers.shouldClearHistory({
      type: "session_state",
      state: "stale-invalidated",
    })).toBe(false)
  })

  test("clears history only after an explicit clear confirmation", () => {
    expect(helpers.shouldClearHistory({
      type: "session_state",
      state: "cleared",
    })).toBe(true)
  })

  test("ignores missing events", () => {
    expect(helpers.shouldClearHistory(null)).toBe(false)
  })

  test("reads image dimensions from safe headers before browser decoding", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1ZsAAAAASUVORK5CYII=",
      "base64",
    )
    expect(helpers.imageDimensions(png, "image/png")).toEqual({ width: 1, height: 1 })

    png.writeUInt32BE(50_000, 16)
    expect(helpers.imageDimensions(png, "image/png")).toEqual({ width: 50_000, height: 1 })
    expect(helpers.imageDimensions(png, "image/jpeg")).toBeNull()
  })

  test("accepts bounded passive thumbnail data URLs only", () => {
    expect(helpers.safeThumbnailDataUrl("data:image/webp;base64,YQ==", 100)).toBe(true)
    expect(helpers.safeThumbnailDataUrl("data:image/png;base64,YQ==", 10)).toBe(false)
    expect(helpers.safeThumbnailDataUrl("data:image/svg+xml;base64,YQ==", 100)).toBe(false)
    expect(helpers.safeThumbnailDataUrl("javascript:alert(1)", 100)).toBe(false)
  })

  test("evicts oldest thumbnails to meet the session budget", () => {
    expect(helpers.thumbnailKeysToEvict([
      { key: "new", size: 50, createdAt: 30 },
      { key: "old", size: 70, createdAt: 10 },
      { key: "middle", size: 60, createdAt: 20 },
    ], 100)).toEqual(["old", "middle"])
    expect(helpers.thumbnailKeysToEvict([
      { key: "kept", size: 50, createdAt: 10 },
    ], 100)).toEqual([])
  })

  test("accepts only finite positive timeout overrides", () => {
    expect(helpers.positiveTimeout(250, 1000)).toBe(250)
    expect(helpers.positiveTimeout(0, 1000)).toBe(1000)
    expect(helpers.positiveTimeout(-1, 1000)).toBe(1000)
    expect(helpers.positiveTimeout(Infinity, 1000)).toBe(1000)
    expect(helpers.positiveTimeout("250", 1000)).toBe(1000)
  })
})
