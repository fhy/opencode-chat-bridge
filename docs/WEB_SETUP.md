# Web Connector Setup

Embeddable chat widget for any webpage. Serves a JavaScript widget via HTTP and communicates in real-time over WebSocket.

## Modes

- **Widget** (default) — floating bubble in the corner, opens a popup chat panel
- **Embedded** — fills a container element, no bubble, always visible
- **Full page** — standalone chat served directly by the connector at `/chat`

## Quick Start

```bash
bun connectors/web.ts
```

Open `http://<your-ip>:3420/chat` for the standalone full-page chat, or `/test` for the widget demo.

## Configuration

Settings go in `chat-bridge.json` under the `web` key. Environment variables override them.

### chat-bridge.json

```json
{
  "web": {
    "enabled": true,
    "port": 3420,
    "host": "0.0.0.0",
    "allowedOrigins": ["*"],
    "publicUrl": "",
    "attachments": {
      "enabled": false,
      "maxFileBytes": 5242880,
      "maxFilesPerMessage": 1,
      "maxWidth": 4096,
      "maxHeight": 4096,
      "maxPixels": 20000000,
      "resizeMaxDimension": 2048,
      "allowedMimeTypes": ["image/jpeg", "image/png", "image/webp"]
    }
  }
}
```

| Setting | Description | Default |
|---------|-------------|---------|
| `port` | HTTP/WebSocket server port | `3420` |
| `host` | Bind address | `0.0.0.0` (all interfaces) |
| `allowedOrigins` | Origins allowed to connect. `["*"]` = any | `["*"]` |
| `publicUrl` | URL shown in logs and embed snippets (for reverse proxy setups) | auto-detected |
| `attachments.enabled` | Allow image selection and clipboard paste | `false` |
| `attachments.maxFileBytes` | Maximum decoded bytes per image | `5242880` |
| `attachments.maxFilesPerMessage` | Maximum images in one prompt | `1` |
| `attachments.maxWidth` / `maxHeight` | Hard source-dimension limits | `4096` |
| `attachments.maxPixels` | Hard decoded pixel limit | `20000000` |
| `attachments.resizeMaxDimension` | Browser-side resize target | `2048` |
| `attachments.allowedMimeTypes` | Accepted image formats | JPEG, PNG, WebP |

### Environment Variables

Environment variables override `chat-bridge.json`:

| Variable | Overrides | Example |
|----------|-----------|---------|
| `WEB_PORT` | `web.port` | `3420` |
| `WEB_HOST` | `web.host` | `0.0.0.0` |
| `WEB_ALLOWED_ORIGINS` | `web.allowedOrigins` (comma-separated) | `https://mysite.com,https://app.mysite.com` |
| `WEB_PUBLIC_URL` | `web.publicUrl` | `https://chat.mysite.com` |
| `WEB_TRIGGER` | Global trigger override | `!bot` |

## Embedding

### Widget Mode (floating bubble)

Add a single script tag to any page:

```html
<script src="http://your-server:3420/widget.js"></script>
```

### Embedded Mode (fills a container)

```html
<div id="chat" style="height: 600px"></div>
<script>
  window.OpenCodeWidget = { mode: "embedded", container: "#chat" };
</script>
<script src="http://your-server:3420/widget.js"></script>
```

### Full-Page Mode

Open the standalone client directly:

```text
http://your-server:3420/chat
```

It reuses embedded mode in a viewport-sized container, so it has the same features and configuration defaults without maintaining a separate frontend.

### Widget Configuration

Set `window.OpenCodeWidget` before loading the script:

```html
<script>
  window.OpenCodeWidget = {
    mode: "widget",            // "widget" or "embedded"
    container: "#chat",        // CSS selector (embedded mode only)
    title: "AI Assistant",     // Header title
    placeholder: "Ask me...",  // Input placeholder
    welcome: "Hello!",        // Welcome message (null = none)
    position: "right",         // Bubble position: "right" or "left"
    connectTimeoutMs: 10000,    // Retry a stuck WebSocket connection
    processingTimeoutMs: 330000, // Restore the UI after a lost response
    theme: {
      primary: "#2563eb",      // Bubble and send button color
      header: "#1e293b",       // Header background
      userBg: "#2563eb",       // User message bubble
      userText: "#ffffff",
      botBg: "#f1f5f9",        // Bot message bubble
      botText: "#1e293b",
    }
  };
</script>
<script src="http://your-server:3420/widget.js"></script>
```

## Security

**The web widget has no built-in user authentication.** Anyone who can reach the server can use it.

See [Security — Web Connector](SECURITY.md#web-connector-security) for the full threat model.

### Recommended Deployments

| Scenario | Safe? |
|----------|-------|
| Private network / intranet | Yes — network access is the auth |
| VPN-only access | Yes |
| Behind reverse proxy with auth (nginx + OAuth) | Yes |
| Public internet, unrestricted | **No** |
| Public internet, origin-restricted | Partial |

### Restricting Origins

Limit which websites can embed your widget:

```json
{
  "web": {
    "allowedOrigins": ["https://mysite.com", "https://app.mysite.com"]
  }
}
```

Browsers enforce the Origin header on WebSocket connections. This prevents other websites from connecting but does not stop non-browser clients (curl, scripts).

### Reverse Proxy (HTTPS)

For production, put the connector behind nginx or Caddy with TLS and authentication:

```
[Browser] --> [nginx + TLS + OAuth2 Proxy] --> [web connector :3420]
```

Set `publicUrl` so embed snippets show the correct URL:

```json
{
  "web": {
    "publicUrl": "https://chat.mysite.com"
  }
}
```

## Images and Documents

When `web.attachments.enabled` is true, users can select an image or paste one
into the composer with Ctrl+V. The browser validates compressed size and decoded
dimensions, resizes safe oversized images before sending, displays a removable
preview, and requires an explicit Send action. Image bytes are not written to
localStorage or the session workspace.

The server independently verifies base64 size, MIME allowlisting, file magic,
dimensions, and pixel count before forwarding native image content to ACP. SVG
and other active formats are not accepted. Keep this feature disabled on public
unauthenticated deployments; `allowedOrigins` is not authentication.

The AI can also create files and display them inline in the chat.

### Images

When the AI creates an image (e.g., via ImageMagick, Python), it wraps the path in markers:

```
[DOCLIBRARY_IMAGE]/path/to/image.png[/DOCLIBRARY_IMAGE]
```

The bridge reads the file, converts to base64, and sends it to the widget which displays it inline.

To enable this, include in your agent prompt (`opencode.json`):

```
When you create or reference an image file, output its absolute path wrapped exactly like this: [DOCLIBRARY_IMAGE]/full/path/to/file.png[/DOCLIBRARY_IMAGE] so the chat can display it inline.
```

### Documents

Same pattern with document markers:

```
[DOCLIBRARY_DOC]/path/to/document.pdf[/DOCLIBRARY_DOC]
```

Documents appear as clickable download links in the chat. Add to your agent prompt:

```
For documents use [DOCLIBRARY_DOC]/full/path/to/file.pdf[/DOCLIBRARY_DOC].
```

## Features

### Streaming

- Response text streams in real-time (character by character)
- Tool output (bash, etc.) streams in a dark terminal-style block
- Tool output collapses into a clickable toggle after the response completes
- Permission denials are shown inline

### Session Management

- ACP mappings are persisted by connector and browser `clientId` in
  `sessionStorePath`, including the backend session ID and canonical workspace.
- After a bridge restart, reconnecting with the same browser `clientId` reports
  the conversation as resumed and restores the ACP session on the next request.
- Commands: `/help`, `/status`, `/clear`

### Chat History

- The widget stores the last 50 visible messages in browser localStorage.
- Bridge restarts, reconnects, session invalidation, and backend errors preserve
  local history.
- History clears only through the trash button or a confirmed `/clear` or
  `/reset` command.

## Test Pages

The connector serves two test pages:

- `http://your-server:3420/test` — widget mode demo
- `http://your-server:3420/test-embedded` — embedded mode demo

## Endpoints

| Path | Description |
|------|-------------|
| `/widget.js` | The embeddable widget JavaScript |
| `/chat` | Standalone full-page chat |
| `/ws` | WebSocket endpoint (clients connect here) |
| `/health` | JSON health check (`{"status":"ok",...}`) |
| `/test` | Widget mode test page |
| `/test-embedded` | Embedded mode test page |

## Docker

```yaml
web:
  build: .
  command: ["bun", "connectors/web.ts"]
  ports:
    - "3420:3420"
  environment:
    - WEB_PORT=3420
    - WEB_ALLOWED_ORIGINS=*
  volumes:
    - ./opencode.json:/app/opencode.json:ro
    - ./chat-bridge.json:/app/chat-bridge.json:ro
```

## Troubleshooting

### "Connection refused" from another machine

The server binds to `0.0.0.0` by default (all interfaces). Check:
1. Server is running: `curl http://server-ip:3420/health`
2. Firewall allows port 3420
3. You're using the server's LAN IP, not `localhost`

### Widget shows "Disconnected"

The WebSocket connection dropped. The widget reconnects automatically with exponential backoff. A connection that remains stuck in `Connecting...` is closed after 10 seconds and retried. Check server logs for errors.

If a socket drops while a request is running and no terminal response arrives, the widget restores the send button after 5.5 minutes and displays a timeout message. Override these watchdogs with `connectTimeoutMs` and `processingTimeoutMs` in `window.OpenCodeWidget` when needed.

### Images not displaying

1. Make sure the agent prompt includes the `[DOCLIBRARY_IMAGE]` instruction
2. Check the file path is absolute and the file exists on the server
3. Check server logs for `[IMG]` entries
