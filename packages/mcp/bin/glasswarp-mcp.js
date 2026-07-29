#!/usr/bin/env node
/**
 * Local stdio → remote Glasswarp MCP (Streamable HTTP).
 * Thin launcher around mcp-remote; requires GLASSWARP_API_KEY.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const DEFAULT_URL = "https://mcp.glasswarp.com/mcp";

function usage() {
  console.error(`glasswarp-mcp — local stdio bridge to Glasswarp remote MCP

Usage:
  GLASSWARP_API_KEY=gw_… npx @glasswarp/mcp

Env:
  GLASSWARP_API_KEY   required — API key from https://www.glasswarp.com/console
  GLASSWARP_MCP_URL   optional — default ${DEFAULT_URL}
  GLASSWARP_AUTH      optional — full "Bearer gw_…" (overrides API_KEY if set)

Cursor mcp.json example:
  {
    "mcpServers": {
      "glasswarp": {
        "command": "npx",
        "args": ["-y", "@glasswarp/mcp"],
        "env": { "GLASSWARP_API_KEY": "gw_live_sk_…" }
      }
    }
  }

Docs: https://docs.glasswarp.com/get-started/mcp
`);
  process.exit(1);
}

const raw =
  process.env.GLASSWARP_AUTH?.trim() ||
  process.env.GLASSWARP_API_KEY?.trim() ||
  "";
if (!raw || raw.includes("REPLACE") || raw === "gw_…" || raw === "gw_") {
  usage();
}

const auth = /^Bearer\s+/i.test(raw) ? raw : `Bearer ${raw}`;
const url = (process.env.GLASSWARP_MCP_URL || DEFAULT_URL).trim();

const require = createRequire(import.meta.url);
let proxyJs;
try {
  proxyJs = require.resolve("mcp-remote/dist/proxy.js");
} catch {
  console.error(
    "glasswarp-mcp: could not resolve mcp-remote. Reinstall with: npm i @glasswarp/mcp",
  );
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [proxyJs, url, "--header", `Authorization:${auth}`],
  {
    stdio: "inherit",
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}
