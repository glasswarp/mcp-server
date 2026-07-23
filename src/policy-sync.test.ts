/**
 * Drift guard for the ways-to-run-agents policy (model voice).
 *
 * Canonical text: ways-to-run-agents-policy.md → MCP_BEST_PRACTICES.
 * When this package lives inside the Glasswarp monorepo, also assert SKILL.md
 * embeds the policy and public pages do not republish it. Standalone clones
 * skip those monorepo-only checks.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { MCP_BEST_PRACTICES } from "./best-practices.js";

const here = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(here, "../..");
const inMonorepo = existsSync(join(monorepoRoot, "web-client/public/SKILL.md"));

const FINGERPRINTS = [
  "status USABLE (online, API access enabled by the",
  'Never scaffold code for a short task — "click OK" must never generate a file.',
  "Do not impose it. If the user prefers chat or says \"just do it here,\"",
  "These path names (Assist / Showcase / Scaffold) are internal vocabulary",
  "uses NATIVE screen coordinates as reported by observe — not the downscaled",
  "Plan ahead when the next steps are predictable",
  "Observe after every meaningful step",
  "Verification-grade JPEGs: `max_width=960`",
];

function assertContainsPolicy(label: string, text: string) {
  for (const fp of FINGERPRINTS) {
    assert.ok(text.includes(fp), `${label} missing fingerprint:\n  ${fp}`);
  }
}

function assertNoPolicy(label: string, text: string) {
  for (const fp of FINGERPRINTS) {
    assert.ok(
      !text.includes(fp),
      `${label} must not embed the model policy, found fingerprint:\n  ${fp}`,
    );
  }
}

describe("ways-to-run-agents policy sync", () => {
  it("MCP_BEST_PRACTICES matches the canonical markdown file", () => {
    const file = readFileSync(
      join(here, "ways-to-run-agents-policy.md"),
      "utf8",
    ).trim();
    assert.equal(MCP_BEST_PRACTICES, file);
  });

  it("SKILL.md embeds the policy (monorepo only)", { skip: !inMonorepo }, () => {
    assertContainsPolicy(
      "SKILL.md",
      readFileSync(join(monorepoRoot, "web-client/public/SKILL.md"), "utf8"),
    );
  });

  it("public pages do not republish the policy (monorepo only)", {
    skip: !inMonorepo,
  }, () => {
    const publicPages = [
      "docs-site/get-started/mcp.mdx",
      "docs-site/guides/ways-to-run-agents.mdx",
      "web-client/src/pages/McpPage.tsx",
      "web-client/scripts/static-marketing-html.mjs",
      "web-client/public/llms.txt",
    ];
    for (const page of publicPages) {
      assertNoPolicy(page, readFileSync(join(monorepoRoot, page), "utf8"));
    }
  });
});
