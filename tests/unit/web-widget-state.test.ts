import { describe, expect, test } from "bun:test"
import "../../connectors/web-widget-state.js"

type WidgetStateHelpers = {
  shouldClearHistory(state: {
    hasSession: boolean
    messageCount: number
    isProcessing: boolean
    hasPendingMessage: boolean
  }): boolean
  positiveTimeout(value: unknown, fallback: number): number
}

const helpers = (globalThis as typeof globalThis & {
  OpenCodeWidgetState: WidgetStateHelpers
}).OpenCodeWidgetState

describe("Web widget connection state", () => {
  test("clears stale history when the server confirms no session", () => {
    expect(helpers.shouldClearHistory({
      hasSession: false,
      messageCount: 2,
      isProcessing: false,
      hasPendingMessage: false,
    })).toBe(true)
  })

  test("preserves history while a request is processing", () => {
    expect(helpers.shouldClearHistory({
      hasSession: false,
      messageCount: 1,
      isProcessing: true,
      hasPendingMessage: false,
    })).toBe(false)
  })

  test("preserves history while a message is queued", () => {
    expect(helpers.shouldClearHistory({
      hasSession: false,
      messageCount: 1,
      isProcessing: false,
      hasPendingMessage: true,
    })).toBe(false)
  })

  test("preserves history when the server has a session", () => {
    expect(helpers.shouldClearHistory({
      hasSession: true,
      messageCount: 2,
      isProcessing: false,
      hasPendingMessage: false,
    })).toBe(false)
  })

  test("does nothing when history is already empty", () => {
    expect(helpers.shouldClearHistory({
      hasSession: false,
      messageCount: 0,
      isProcessing: false,
      hasPendingMessage: false,
    })).toBe(false)
  })

  test("accepts only finite positive timeout overrides", () => {
    expect(helpers.positiveTimeout(250, 1000)).toBe(250)
    expect(helpers.positiveTimeout(0, 1000)).toBe(1000)
    expect(helpers.positiveTimeout(-1, 1000)).toBe(1000)
    expect(helpers.positiveTimeout(Infinity, 1000)).toBe(1000)
    expect(helpers.positiveTimeout("250", 1000)).toBe(1000)
  })
})
