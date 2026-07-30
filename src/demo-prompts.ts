/**
 * MCP prompts for showcase demos.
 *
 * Prefer demos.get → glasswarp-demo. MCP tools = Assist / preflight / recovery.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { formatDemoCard, getDemo } from "./demos.js";

const FRAMING = `
Framing (PRODUCT_MISSION §0):
  ✅ "An agent did X on a real Windows PC through the Glasswarp API."
  ❌ "Glasswarp did X."
`.trim();

const PREFLIGHT = `
Preflight with MCP Assist (short):
1. rigs.list — need USABLE (online + api_access_enabled)
2. Optional Live View: session.start → session.live_view → session.end
   (demo scripts open their own session)
`.trim();

function showcasePlaybook(demoId: "minesweeper" | "mona-lisa"): string {
  const d = getDemo(demoId)!;
  return [
    `The user wants the **${d.title}** showcase at demo speed.`,
    "",
    FRAMING,
    PREFLIGHT,
    "",
    "**Preferred:** call `demos.get` (or read the card below), then run the command.",
    "Do **not** put the chat model in the observe→decide→act inner loop.",
    "",
    formatDemoCard(d),
  ].join("\n");
}

export function registerDemoPrompts(server: McpServer): void {
  server.registerPrompt(
    "demo_mona_lisa",
    {
      title: "Demo: Mona Lisa (demos.get → glasswarp-demo)",
      description:
        "Showcase lane: demos.get mona-lisa, then run glasswarp-demo. MCP Assist for preflight only.",
      argsSchema: {
        notes: z.string().optional().describe("Optional extra instructions"),
      },
    },
    ({ notes }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              showcasePlaybook("mona-lisa") +
              (notes?.trim() ? `\n\nAdditional user notes:\n${notes.trim()}` : ""),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "demo_minesweeper",
    {
      title: "Demo: Minesweeper (demos.get → glasswarp-demo)",
      description:
        "Showcase lane: demos.get minesweeper, then run glasswarp-demo. Deterministic loop as brain.",
      argsSchema: {
        notes: z.string().optional().describe("Optional extra instructions"),
      },
    },
    ({ notes }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              showcasePlaybook("minesweeper") +
              (notes?.trim() ? `\n\nAdditional user notes:\n${notes.trim()}` : ""),
          },
        },
      ],
    }),
  );
}
