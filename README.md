# Glasswarp MCP server

Remote MCP endpoint for Glasswarp — agents observe and control real Windows machines; you supply the task logic.

**Install / connect:** [docs.glasswarp.com/get-started/mcp](https://docs.glasswarp.com/get-started/mcp) · API key from the [console](https://www.glasswarp.com/console).

**Open:** this MCP server + the [Python SDK](https://github.com/glasswarp/python-sdk). **Not open:** the Windows host agent and the Glasswarp platform (gateway, console, billing).

---

Remote [Model Context Protocol](https://modelcontextprotocol.io) server — a thin
translation layer over the Platform API (`/v1/*`). Gives MCP clients eyes and
hands on paired Windows rigs; the client/model supplies the brain.

**Design:** [`docs/MCP_SERVER_DESIGN.md`](https://docs.glasswarp.com/get-started/mcp)

## Auth

```
Authorization: Bearer <glasswarp_api_key>
```

Create a key at [glasswarp.com/console](https://www.glasswarp.com/console).
Full keys are never logged (prefix/suffix redaction only).

## Run locally

```bash
cd mcp-server
npm install
npm run dev
# POST http://127.0.0.1:8787/mcp
```

Point at a non-prod API:

```bash
GLASSWARP_API_BASE_URL=http://127.0.0.1:8080 npm run dev
```

## Cursor / Claude

**Production URL:** `https://mcp.glasswarp.com/mcp`  
**Auth:** `Authorization: Bearer <your real gw_… key>` (never the placeholder from docs)

### Cursor (recommended — stdio bridge)

Current Cursor builds often fail remote Streamable HTTP with `fetch failed`.
Bridge over stdio with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote).

**Important:** use an **absolute** `npx` path for your OS. Bare `npx` inside
Cursor often fails with `ENOENT .../Cursor.app/.../resources/lib`.

| OS | `command` | `PATH` (env) |
| --- | --- | --- |
| macOS Apple Silicon | `/opt/homebrew/bin/npx` | `/opt/homebrew/bin:/usr/bin:/bin` |
| macOS Intel | `/usr/local/bin/npx` | `/usr/local/bin:/usr/bin:/bin` |
| Windows | `npx` (or full `npx.cmd`) | (default Node path) |
| Linux | `/usr/bin/npx` (or your nvm path) | `/usr/bin:/bin` |

Example (macOS Apple Silicon):

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

Restart MCP / reload Cursor, then call `list_rigs`.

### Ways to run agents (every client)

On initialize, the server sends **`instructions`**: short → MCP; longer →
**offer** scaffold/`glasswarp-demo` when code-capable (never impose); chat-only
stays on MCP. Also:

| Surface | Role |
| --- | --- |
| Prompt `best_practices` | Same guide on demand |
| Resource `glasswarp://guide/ways-to-run-agents` | Markdown copy |
| Tools `list_demos` / `get_demo` | Showcase run contracts (no solver execution) |
| Resources `glasswarp://demos`, `glasswarp://demos/{id}` | Same cards |
| `demo_minesweeper` / `demo_mona_lisa` | Offer `glasswarp-demo …` |

```bash
pip install "glasswarp[demos]"
glasswarp-demo minesweeper
```

Docs: https://docs.glasswarp.com/guides/ways-to-run-agents

### Direct remote URL (when the client supports headers)

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

## Tools

`list_rigs`, `start_session`, `end_session`, `observe`, `click_target`,
`click_xy`, `type_text`, `send_keys`, `drag`, `scroll`, `launch_app`,
`get_live_view_url`, `get_session_status`.

## Tests

```bash
npm test
npm run build
```
