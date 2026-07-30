# Glasswarp MCP Server

**See and control a real Windows PC you own** — from any MCP client. Observe, click, type, launch apps, Live View. You bring the model; Glasswarp is eyes and hands.

No cloud desktop — install our host on **your** Windows machine.

| | |
| --- | --- |
| **Remote URL** | `https://mcp.glasswarp.com/mcp` |
| **Auth** | `Authorization: Bearer gw_…` ([create a key](https://www.glasswarp.com/console)) |
| **Docs** | [docs.glasswarp.com/get-started/mcp](https://docs.glasswarp.com/get-started/mcp) |

## Start here

1. **API key** — [Console](https://www.glasswarp.com/console) → create key → copy `gw_…`
2. **Windows PC** — [install](https://www.glasswarp.com/downloads) → [pair](https://www.glasswarp.com/pair) → enable **API access**
3. **Paste the key** as `GLASSWARP_API_KEY` (or `Authorization: Bearer gw_…` on the remote URL)

Say *“List my rigs.”* You need a **USABLE** machine.

[Docs](https://docs.glasswarp.com/get-started/mcp) · [hello@glasswarp.com](mailto:hello@glasswarp.com)

## Connect (Cursor)

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

Same tools via remote URL `https://mcp.glasswarp.com/mcp` when the client supports headers. More clients: [docs](https://docs.glasswarp.com/get-started/mcp).

## Workflow

`rigs.list` → `session.start` → `screen.observe` → act → `session.end`  
Prefer `input.send_actions` for multi-step work. Always end the session.

## Tools

| Tool | Role |
| --- | --- |
| `rigs.list` | Find a USABLE paired Windows machine |
| `session.start` / `session.end` | Metered session (always end) |
| `screen.observe` | UIA targets + text (`image=true` for JPEG) |
| `input.*` | click, type, keys, drag, scroll, `send_actions` |
| `app.launch` | Start an exe on the rig |
| `session.live_view` / `session.status` | Owner Live View · billing signals |
| `demos.list` / `demos.get` | Showcase run contracts |

## More

- npm: [`@glasswarp/mcp`](https://www.npmjs.com/package/@glasswarp/mcp) · registry: `com.glasswarp/mcp-server` · Apache-2.0
- **Open:** this MCP server + [Python SDK](https://github.com/glasswarp/python-sdk). **Not open:** Windows host agent and platform (gateway, console, billing).
- Local dev / tests: see repo `package.json` scripts (`npm run dev`, `npm test`)
