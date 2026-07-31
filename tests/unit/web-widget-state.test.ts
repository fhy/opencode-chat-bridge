import { describe, expect, test } from "bun:test"
import "../../connectors/web-widget-state.js"

type WidgetStateHelpers = {
  shouldClearHistory(event: {
    type?: string
    state?: string
    hasSession?: boolean
  } | null): boolean
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

  test("accepts only finite positive timeout overrides", () => {
    expect(helpers.positiveTimeout(250, 1000)).toBe(250)
    expect(helpers.positiveTimeout(0, 1000)).toBe(1000)
    expect(helpers.positiveTimeout(-1, 1000)).toBe(1000)
    expect(helpers.positiveTimeout(Infinity, 1000)).toBe(1000)
    expect(helpers.positiveTimeout("250", 1000)).toBe(1000)
  })
})
