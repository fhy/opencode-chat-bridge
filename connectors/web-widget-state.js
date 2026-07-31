/**
 * Pure state decisions shared by the Web widget runtime and unit tests.
 */
;(function (global) {
  "use strict"

  function shouldClearHistory(event) {
    return Boolean(event) &&
      event.type === "session_state" &&
      event.state === "cleared"
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
