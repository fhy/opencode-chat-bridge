/**
 * Matrix thread context helpers (pure functions, no SDK dependency)
 *
 * Extracted so tests can import them without needing matrix-bot-sdk installed.
 */

/**
 * Normalized context extracted from a Matrix room event.
 */
export interface MatrixEventContext {
  roomId: string
  sender: string
  text: string
  eventId: string
  /** Non-empty when this event is inside a m.thread relation */
  threadRootEventId: string
  /** The event ID to use as the thread root when replying */
  replyThreadRootId: string
  /** Session key: room:threadRootEventId (thread isolation) or room (per-room) */
  sessionId: string
  /** Idempotency key */
  dedupeId: string
}

/**
 * Extract the m.thread root event ID from event content, if present.
 * Returns empty string for non-threaded events.
 */
export function extractThreadRootId(event: any): string {
  const relatesTo = event?.content?.["m.relates_to"]
  if (relatesTo?.rel_type === "m.thread" && relatesTo?.event_id) {
    return relatesTo.event_id
  }
  return ""
}

/**
 * Extract a query prefixed by the configured bot name.
 * Accepts "name: query", "name query", and optional leading "@" forms.
 */
export function extractBotNameQuery(text: string, botName: string): string | null {
  const name = botName.trim()
  if (!name) return null

  const prefixes = [`@${name}`, name]

  for (const prefix of prefixes) {
    if (text.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) continue
    const separator = text.charAt(prefix.length)
    if (separator !== ":" && !/\s/.test(separator)) continue
    return text.slice(prefix.length).replace(/^[:\s]+/, "").trim()
  }

  return null
}

export interface MatrixBotRoute {
  target: string | null
  query: string
}

/** Resolve an explicit leading bot target in a shared Matrix room. */
export function resolveMatrixBotRoute(text: string, botNames: string[]): MatrixBotRoute {
  const candidates = [...new Set(botNames.map((name) => name.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)

  for (const name of candidates) {
    const localName = name.startsWith("@") ? name.slice(1).split(":", 1)[0] : name
    const forms = [...new Set([name, localName, `@${localName}`])].sort((a, b) => b.length - a.length)
    for (const form of forms) {
      if (text.slice(0, form.length).toLowerCase() !== form.toLowerCase()) continue
      let end = form.length
      if (form === `@${localName}` && text.charAt(end) === ":") {
        const fullUserId = text.slice(end + 1).match(/^[^\s:]+/)
        if (fullUserId) end += fullUserId[0].length + 1
      }
      const separator = text.charAt(end)
      if (separator !== ":" && !/\s/.test(separator)) continue
      return {
        target: localName.toLowerCase(),
        query: text.slice(end).replace(/^[:\s]+/, "").trim(),
      }
    }
  }

  return { target: null, query: text.trim() }
}

/**
 * Resolve the thread root event ID.
 * If the event is in a thread, use the thread root. Otherwise use the event itself.
 */
export function resolveThreadRoot(threadRootEventId: string, eventId: string): string {
  return threadRootEventId || eventId
}

/**
 * Build the session key.
 * When threadIsolation is true: room:threadRootEventId (per-thread)
 * When false: room (per-room, old behavior)
 */
export function buildMatrixSessionId(
  roomId: string,
  replyThreadRootId: string,
  threadIsolation: boolean
): string {
  if (threadIsolation) {
    return `${roomId}:${replyThreadRootId}`
  }
  return roomId
}

/**
 * Normalize raw Matrix event fields into a consistent MatrixEventContext.
 */
export function normalizeMatrixEventContext(
  input: {
    roomId: string
    sender?: string
    text?: string
    eventId: string
    threadRootEventId?: string
  },
  threadIsolation: boolean
): MatrixEventContext {
  const roomId = input.roomId
  const eventId = input.eventId
  const threadRootEventId = input.threadRootEventId || ""
  const replyThreadRootId = resolveThreadRoot(threadRootEventId, eventId)

  return {
    roomId,
    sender: input.sender || "unknown",
    text: input.text || "",
    eventId,
    threadRootEventId,
    replyThreadRootId,
    sessionId: buildMatrixSessionId(roomId, replyThreadRootId, threadIsolation),
    dedupeId: eventId,
  }
}

/**
 * Build the m.relates_to content for a thread reply.
 * Includes m.in_reply_to fallback for clients that don't support threads.
 */
export function buildThreadRelation(threadRootEventId: string, lastEventId: string): object {
  return {
    rel_type: "m.thread",
    event_id: threadRootEventId,
    is_falling_back: true,
    "m.in_reply_to": {
      event_id: lastEventId,
    },
  }
}

/**
 * Returns true if a plain thread reply (no trigger, no mention) should be
 * considered for forwarding to the bot.
 */
export function shouldHandleThreadReply(input: {
  text: string
  threadRootEventId: string
  trigger: string
  botUserId: string
}): boolean {
  const text = input.text.trim()
  if (!text) return false
  if (!input.threadRootEventId) return false
  if (text.toLowerCase().startsWith(`${input.trigger.toLowerCase()} `)) return false
  if (text.toLowerCase().startsWith(`${input.trigger.toLowerCase()}`)) return false
  if (text.includes(input.botUserId)) return false
  return true
}
