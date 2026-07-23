/**
 * MCP server `instructions` — every client reads this on initialize.
 *
 * Canonical text: ways-to-run-agents-policy.md
 * Must stay identical in SKILL.md, docs get-started/mcp, guides/ways-to-run-agents,
 * and the marketing /mcp page (see policy-sync.test.ts).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const MCP_BEST_PRACTICES = readFileSync(
  join(here, "ways-to-run-agents-policy.md"),
  "utf8",
).trim();

export const MCP_BEST_PRACTICES_URI = "glasswarp://guide/ways-to-run-agents";
