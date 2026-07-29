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
    "publicUrl": ""
  }
}
```

| Setting | Description | Default |
|---------|-------------|---------|
| `port` | HTTP/WebSocket server port | `3420` |
| `host` | Bind address | `0.0.0.0` (all interfaces) |
| `allowedOrigins` | Origins allowed to connect. `["*"]` = any | `["*"]` |
| `publicUrl` | URL shown in logs and embed snippets (for reverse proxy setups) | auto-detected |

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

The AI can create files and display them inline in the chat.

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

- Sessions persist while the server runs (in-memory)
- Widget stores chat history in localStorage (last 50 messages)
- History clears automatically when connecting to a fresh server session
- Commands: `/help`, `/status`, `/clear`

### Chat History

- Stored in the browser's localStorage
- Cleared automatically when the server session is gone (e.g., server restart)
- Clear manually via the trash icon in the header or the `/clear` command

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
