#!/usr/bin/env node
/**
 * Local stdio → remote Glasswarp MCP (Streamable HTTP).
 * Thin launcher around mcp-remote.
 *
 * GLASSWARP_API_KEY optional for discovery (initialize / tools/list).
 * Required for tools/call against a rig.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

const DEFAULT_URL = "https://mcp.glasswarp.com/mcp";

function usage() {
  console.error(`glasswarp-mcp — local stdio bridge to Glasswarp remote MCP

Usage:
  GLASSWARP_API_KEY=gw_… npx @glasswarp/mcp

Env:
  GLASSWARP_API_KEY   recommended — API key from https://www.glasswarp.com/console
  GLASSWARP_MCP_URL   optional — default ${DEFAULT_URL}
  GLASSWARP_AUTH      optional — full "Bearer gw_…" (overrides API_KEY if set)

Without a key, discovery (initialize / tools/list) still works; tool calls need a key.

Docs: https://docs.glasswarp.com/get-started/mcp
`);
}

const raw =
  process.env.GLASSWARP_AUTH?.trim() ||
  process.env.GLASSWARP_API_KEY?.trim() ||
  "";
const hasKey =
  !!raw && !raw.includes("REPLACE") && raw !== "gw_…" && raw !== "gw_";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  usage();
  process.exit(0);
}

const url = (process.env.GLASSWARP_MCP_URL || DEFAULT_URL).trim();
const requireFromBin = createRequire(import.meta.url);
const requireFromCwd = createRequire(join(process.cwd(), "package.json"));

function resolveProxy() {
  try {
    return requireFromBin.resolve("mcp-remote/dist/proxy.js");
  } catch {
    return requireFromCwd.resolve("mcp-remote/dist/proxy.js");
  }
}

let proxyJs;
try {
  proxyJs = resolveProxy();
} catch {
  console.error(
    "glasswarp-mcp: could not resolve mcp-remote. Run npm/pnpm install (needs mcp-remote).",
  );
  process.exit(1);
}

const args = [proxyJs, url];
if (hasKey) {
  const auth = /^Bearer\s+/i.test(raw) ? raw : `Bearer ${raw}`;
  args.push("--header", `Authorization:${auth}`);
} else {
  console.error(
    "glasswarp-mcp: no GLASSWARP_API_KEY — discovery only. Create a key at https://www.glasswarp.com/signup → console.",
  );
}

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});

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
