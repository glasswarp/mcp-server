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

## Start here (60 seconds)

Glasswarp controls a **Windows PC you own** — not a cloud desktop. Do this once:

1. **Create an API key** — [Sign up / Console → API Keys](https://www.glasswarp.com/console) → copy `gw_…`
2. **Pair a Windows rig** — [Download the host](https://www.glasswarp.com/downloads) → [pair](https://www.glasswarp.com/pair) → enable **API access** on that rig
3. **Connect MCP** (pick one):
   - **Glama / Install Server** — paste the key into `GLASSWARP_API_KEY`, then Install
   - **Cursor** — paste the JSON below (replace the placeholder key)
   - **Remote URL** — `https://mcp.glasswarp.com/mcp` with header `Authorization: Bearer gw_…`

Then ask the agent: *“List my rigs.”* You want a **USABLE** machine. Workflow: `rigs.list` → `session.start` → `screen.observe` → act → `session.end`.

Full guide: [docs.glasswarp.com/get-started/mcp](https://docs.glasswarp.com/get-started/mcp)

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

Restart MCP, then call `rigs.list`.

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
rigs.list → session.start → screen.observe → act (prefer input.send_actions) → session.end
```

Short tasks stay on MCP. Longer tasks: offer a scaffolded SDK agent / `glasswarp-demo` when the client can run code — never impose it.

## Tools

| Tool | Role |
| --- | --- |
| `rigs.list` | Find a USABLE paired Windows machine |
| `session.start` / `session.end` | Metered session lifecycle (always end) |
| `screen.observe` | UIA targets + text (JPEG opt-in via `image=true`) |
| `input.click_target` / `input.click_xy` / `input.type_text` / `input.send_keys` / `input.drag` / `input.scroll` | Single acts |
| `input.send_actions` | Preferred multi-step batch (1–10) |
| `app.launch` | Start an exe on the rig |
| `session.live_view` | Owner Live View link |
| `session.status` | Billing / status signals |
| `demos.list` / `demos.get` | Showcase run contracts (no solver execution) |

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
