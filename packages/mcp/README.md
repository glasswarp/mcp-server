# @glasswarp/mcp

Local **stdio** bridge to the Glasswarp remote MCP server. Same eyes-and-hands tools as `https://mcp.glasswarp.com/mcp` — no Windows agent bundled here; you still pair a rig in the [console](https://www.glasswarp.com/console) (sign up at [glasswarp.com/signup](https://www.glasswarp.com/signup) if needed).

```bash
npx -y @glasswarp/mcp
```

Requires `GLASSWARP_API_KEY` (create at [console → API Keys](https://www.glasswarp.com/console)).

## Cursor

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

On macOS, if bare `npx` fails inside Cursor (`ENOENT` under `Cursor.app`), use an absolute path:

```json
{
  "mcpServers": {
    "glasswarp": {
      "command": "/opt/homebrew/bin/npx",
      "args": ["-y", "@glasswarp/mcp"],
      "env": {
        "PATH": "/opt/homebrew/bin:/usr/bin:/bin",
        "GLASSWARP_API_KEY": "gw_live_sk_REPLACE_WITH_YOUR_KEY"
      }
    }
  }
}
```

## Env

| Variable | Required | Default |
| --- | --- | --- |
| `GLASSWARP_API_KEY` | yes* | — |
| `GLASSWARP_AUTH` | alt | full `Bearer gw_…` (overrides API key) |
| `GLASSWARP_MCP_URL` | no | `https://mcp.glasswarp.com/mcp` |

\* Or `GLASSWARP_AUTH`.

## Docs

- https://docs.glasswarp.com/get-started/mcp  
- https://www.glasswarp.com/mcp  

License: Apache-2.0
