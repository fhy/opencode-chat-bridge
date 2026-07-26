import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import {
  telegramRetryDelayMs,
  tgApi,
  tgUpload,
} from "../../connectors/telegram"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function telegramResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("Telegram outbound rate-limit retries", () => {
  test("retries an HTTP 429 using retry_after", async () => {
    let calls = 0
    globalThis.fetch = (async () => {
      calls++
      if (calls === 1) {
        return telegramResponse({
          ok: false,
          error_code: 429,
          description: "Too Many Requests",
          parameters: { retry_after: 0 },
        }, 429)
      }
      return telegramResponse({ ok: true, result: { message_id: 17 } })
    }) as typeof fetch

    await expect(tgApi("sendMessage", { text: "hello" })).resolves.toEqual({ message_id: 17 })
    expect(calls).toBe(2)
  })

  test("retries a JSON 429 returned with HTTP 200", async () => {
    let calls = 0
    globalThis.fetch = (async () => {
      calls++
      if (calls === 1) {
        return telegramResponse({
          ok: false,
          error_code: 429,
          description: "Too Many Requests",
          parameters: { retry_after: 0 },
        })
      }
      return telegramResponse({ ok: true, result: true })
    }) as typeof fetch

    await expect(tgApi("sendChatAction")).resolves.toBe(true)
    expect(calls).toBe(2)
  })

  test("stops after five retries", async () => {
    let calls = 0
    globalThis.fetch = (async () => {
      calls++
      return telegramResponse({
        ok: false,
        error_code: 429,
        description: "Too Many Requests",
        parameters: { retry_after: 0 },
      }, 429)
    }) as typeof fetch

    await expect(tgApi("sendMessage")).rejects.toMatchObject({ status: 429 })
    expect(calls).toBe(6)
  })

  test("does not retry non-rate-limit errors", async () => {
    let calls = 0
    globalThis.fetch = (async () => {
      calls++
      return telegramResponse({ ok: false, error_code: 400, description: "Bad Request" }, 400)
    }) as typeof fetch

    await expect(tgApi("sendMessage")).rejects.toMatchObject({ status: 400 })
    expect(calls).toBe(1)
  })

  test("rebuilds and retries multipart uploads", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "telegram-rate-limit-"))
    const filePath = path.join(dir, "document.txt")
    fs.writeFileSync(filePath, "test")
    let calls = 0

    try {
      globalThis.fetch = (async (_input, init) => {
        calls++
        expect(init?.body).toBeInstanceOf(FormData)
        if (calls === 1) {
          return telegramResponse({
            ok: false,
            error_code: 429,
            parameters: { retry_after: 0 },
          }, 429)
        }
        return telegramResponse({ ok: true, result: { message_id: 18 } })
      }) as typeof fetch

      await expect(tgUpload("sendDocument", { chat_id: "1" }, filePath, "document"))
        .resolves.toEqual({ message_id: 18 })
      expect(calls).toBe(2)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test("uses a safe fallback and caps excessive retry delays", () => {
    expect(telegramRetryDelayMs()).toBe(5_000)
    expect(telegramRetryDelayMs(-1)).toBe(0)
    expect(telegramRetryDelayMs(12)).toBe(12_000)
    expect(telegramRetryDelayMs(3_600)).toBe(300_000)
  })
})
