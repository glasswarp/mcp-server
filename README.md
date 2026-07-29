# Glasswarp MCP Server

**See and control a real Windows PC you own — from any MCP client, locally or remotely.** [Model Context Protocol](https://modelcontextprotocol.io) over the Glasswarp Platform API: observe (UIA + screenshots), click/type/drag/scroll, launch apps, owner Live View. Hosted MCP or `npx @glasswarp/mcp`. BYOH: your machine, your key; you bring the model (task logic).

| | |
| --- | --- |
| **Remote URL** | `https://mcp.glasswarp.com/mcp` |
| **Auth** | `Authorization: Bearer gw_…` ([create a key](https://www.glasswarp.com/console)) |
| **Docs** | [docs.glasswarp.com/get-started/mcp](https://docs.glasswarp.com/get-started/mcp) |
| **License** | Apache-2.0 |
| **Registry** | Official MCP: `com.glasswarp/mcp-server` |

**Open:** this MCP server + the [Python SDK](https://github.com/glasswarp/python-sdk). **Not open:** the Windows host agent and Glasswarp platform (gateway, console, billing).

## Quick connect

### Cursor (recommended) — `npx @glasswarp/mcp`

Local stdio bridge to the remote server (same tools; needs a paired rig + API key):

```json
{
  "mcpServers": {
    "glasswarp": {
      "command": "npx",
      "args": ["-y", "@glasswarp/mcp"],
      "env": {
        "GLASSWARP_API_KEY": "gw_live_sk_REPLACE_WITH_YOUR_KEY"
      }
    }
  }
}
```

If bare `npx` fails inside Cursor (`ENOENT` under `Cursor.app`), use an absolute path (e.g. `/opt/homebrew/bin/npx`) and set `PATH` accordingly.

Package source: [`sdk/mcp`](../sdk/mcp) → npm `@glasswarp/mcp`.

### Cursor — raw `mcp-remote` (equivalent)

```json
{
  "mcpServers": {
    "glasswarp": {
      "command": "/opt/homebrew/bin/npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.glasswarp.com/mcp",
        "--header",
        "Authorization:${GLASSWARP_AUTH}"
      ],
      "env": {
        "PATH": "/opt/homebrew/bin:/usr/bin:/bin",
        "GLASSWARP_AUTH": "Bearer gw_live_sk_REPLACE_WITH_YOUR_KEY"
      }
    }
  }
}
```

| OS | `command` | `PATH` |
| --- | --- | --- |
| macOS Apple Silicon | `/opt/homebrew/bin/npx` | `/opt/homebrew/bin:/usr/bin:/bin` |
| macOS Intel | `/usr/local/bin/npx` | `/usr/local/bin:/usr/bin:/bin` |
| Windows | `npx` (or full `npx.cmd`) | (default Node) |
| Linux | `/usr/bin/npx` (or nvm path) | `/usr/bin:/bin` |

Restart MCP, then call `list_rigs`.

### Direct remote URL (clients that support headers)

```json
{
  "mcpServers": {
    "glasswarp": {
      "url": "https://mcp.glasswarp.com/mcp",
      "headers": {
        "Authorization": "Bearer gw_live_sk_REPLACE_WITH_YOUR_KEY"
      }
    }
  }
}
```

## Standard workflow

```
list_rigs → start_session → observe → act (prefer send_actions) → end_session
```

Short tasks stay on MCP. Longer tasks: offer a scaffolded SDK agent / `glasswarp-demo` when the client can run code — never impose it.

## Tools

| Tool | Role |
| --- | --- |
| `list_rigs` | Find a USABLE paired Windows machine |
| `start_session` / `end_session` | Metered session lifecycle (always end) |
| `observe` | UIA targets + text (JPEG opt-in via `image=true`) |
| `click_target` / `click_xy` / `type_text` / `send_keys` / `drag` / `scroll` | Single acts |
| `send_actions` | Preferred multi-step batch (1–10) |
| `launch_app` | Start an exe on the rig |
| `get_live_view_url` | Owner Live View link |
| `get_session_status` | Billing / status signals |
| `list_demos` / `get_demo` | Showcase run contracts (no solver execution) |

## Run locally (dev)

```bash
cd mcp-server
npm install
npm run dev
# POST http://127.0.0.1:8787/mcp
```

```bash
GLASSWARP_API_BASE_URL=http://127.0.0.1:8080 npm run dev
```

Health: `GET /health` · `GET /healthz` · `GET /ping`

## Auth notes

Full API keys are never logged (prefix/suffix redaction only). Directory probes may call `initialize` / `tools/list` without a key; `tools/call` always requires Bearer auth.

## Tests

```bash
npm test
npm run build
```

## Design

Product design: [docs.glasswarp.com](https://docs.glasswarp.com/get-started/mcp) · messaging: eyes and hands, not the brain.
