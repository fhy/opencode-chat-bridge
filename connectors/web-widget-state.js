/**
 * Pure state decisions shared by the Web widget runtime and unit tests.
 */
;(function (global) {
  "use strict"

  function shouldClearHistory(state) {
    return !state.hasSession &&
      state.messageCount > 0 &&
      !state.isProcessing &&
      !state.hasPendingMessage
  }

  function positiveTimeout(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) && value > 0
      ? value
      : fallback
  }

  global.OpenCodeWidgetState = {
    shouldClearHistory: shouldClearHistory,
    positiveTimeout: positiveTimeout,
  }
})(typeof window !== "undefined" ? window : globalThis)
