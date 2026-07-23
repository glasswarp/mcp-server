import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import {
  ApiError,
  GlasswarpApi,
  liveViewConsoleUrl,
  noEligibleRigMessage,
  type GroundingTarget,
} from "./glasswarp-api.js";
import {
  MCP_BEST_PRACTICES,
  MCP_BEST_PRACTICES_URI,
} from "./best-practices.js";
import {
  DEMO_CONTRACTS,
  DEMOS_INDEX_URI,
  demoUri,
  formatDemoCard,
  formatDemoIndex,
  getDemo,
} from "./demos.js";
import { registerDemoPrompts } from "./demo-prompts.js";
import { keysToEvents } from "./keys.js";

/** Legacy URIs — same content as ways-to-run-agents. */
const LEGACY_ASSIST_SHOWCASE_URI = "glasswarp://guide/assist-showcase-build";
const LEGACY_MCP_VS_SDK_URI = "glasswarp://guide/mcp-vs-sdk";

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    isError,
  };
}

function errResult(err: unknown) {
  if (err instanceof ApiError) {
    return textResult(`[${err.status}] ${err.message}`, true);
  }
  if (err instanceof Error) {
    const cause =
      err.cause instanceof Error
        ? err.cause.message
        : err.cause
          ? String(err.cause)
          : "";
    let msg = cause ? `${err.message} (${cause})` : err.message;
    if (/ENOTFOUND|getaddrinfo|fetch failed/i.test(msg)) {
      msg +=
        " — MCP could not reach the Platform API. Check GLASSWARP_API_BASE_URL on the MCP deploy.";
    }
    return textResult(msg, true);
  }
  return textResult(String(err), true);
}

function targetCenter(t: GroundingTarget): { x: number; y: number } {
  return {
    x: Math.round(t.x + t.w / 2),
    y: Math.round(t.y + t.h / 2),
  };
}

function formatTargets(targets: GroundingTarget[]): string {
  if (!targets.length) {
    return "Targets: (none — use click_xy with native coordinates, or re-observe after UI settles)";
  }
  return [
    "Targets (prefer click_target):",
    ...targets.map((t, i) => {
      const bits = [t.role, t.focused ? "focused" : null, t.masked ? "masked" : null]
        .filter(Boolean)
        .join(", ");
      const name = (t.name || "").trim() || t.id || "control";
      const meta = bits ? ` (${bits})` : "";
      const val = t.masked
        ? " = [redacted]"
        : t.value
          ? ` = ${t.value}`
          : "";
      const { x, y } = targetCenter(t);
      return `[${i + 1}] ${name}${meta}${val}  id=${t.id} @ native (${x},${y})`;
    }),
  ].join("\n");
}

function dirtyHint(dirty: ObservePayloadDirty | undefined | null, changed?: boolean): string {
  if (dirty == null) {
    return "dirty: unavailable (assume changed) — do not treat as unchanged; re-check visually if unsure.";
  }
  if (changed === false) {
    return "changed: false — no visual change since last dirty take; do not re-analyze the image.";
  }
  const rects = dirty?.rects ?? [];
  if (dirty?.empty === true || rects.length === 0) {
    return "changed: false — little or no visual change since last dirty take; skip re-analysis if your last observe is still valid.";
  }
  return `changed: true — ${rects.length} dirty rectangle(s) since last take.`;
}

type ObservePayloadDirty = { rects?: number[][]; empty?: boolean };

export function createGlasswarpMcpServer(apiKey: string): McpServer {
  const api = new GlasswarpApi(apiKey);
  const server = new McpServer(
    {
      name: "glasswarp",
      version: "0.1.0",
      title: "Glasswarp",
      description:
        "Eyes and hands on real Windows PCs you own. You bring the brain. Short tasks → MCP tools; longer tasks → offer scaffold when the client can run code (never impose). Prompts: best_practices, demo_minesweeper, demo_mona_lisa.",
      websiteUrl: "https://docs.glasswarp.com/guides/ways-to-run-agents",
    },
    {
      // Surfaced to every MCP client on initialize — guides any routed LLM.
      instructions: MCP_BEST_PRACTICES,
      capabilities: {},
    },
  );

  const guideMarkdown = `# Ways to run agents — Glasswarp\n\n${MCP_BEST_PRACTICES}\n`;

  server.registerResource(
    "ways-to-run-agents",
    MCP_BEST_PRACTICES_URI,
    {
      description:
        "How to run agents on a rig: short tasks direct via MCP; longer tasks — offer a scaffolded SDK agent when the client can run code, never impose it.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: MCP_BEST_PRACTICES_URI,
          mimeType: "text/markdown",
          text: guideMarkdown,
        },
      ],
    }),
  );

  for (const [name, uri] of [
    ["assist-showcase-build", LEGACY_ASSIST_SHOWCASE_URI],
    ["mcp-vs-sdk", LEGACY_MCP_VS_SDK_URI],
  ] as const) {
    server.registerResource(
      name,
      uri,
      {
        description: `Alias of ${MCP_BEST_PRACTICES_URI}.`,
        mimeType: "text/markdown",
      },
      async () => ({
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: guideMarkdown,
          },
        ],
      }),
    );
  }

  server.registerResource(
    "demos",
    DEMOS_INDEX_URI,
    {
      description:
        "Catalog of showcase run contracts (install + command). Use get_demo for a full card.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: DEMOS_INDEX_URI,
          mimeType: "text/markdown",
          text: formatDemoIndex(),
        },
      ],
    }),
  );

  for (const d of DEMO_CONTRACTS) {
    const uri = demoUri(d.id);
    server.registerResource(
      `demo-${d.id}`,
      uri,
      {
        description: `Run contract: ${d.title} — ${d.command}`,
        mimeType: "text/markdown",
      },
      async () => ({
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: formatDemoCard(d),
          },
        ],
      }),
    );
  }

  server.registerPrompt(
    "best_practices",
    {
      title: "Ways to run agents",
      description:
        "Short → MCP; longer → offer scaffold when code-capable (never impose). Chat-only stays on MCP. Read before Minesweeper/Mona Lisa.",
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: MCP_BEST_PRACTICES },
        },
      ],
    }),
  );

  registerDemoPrompts(server);

  server.registerTool(
    "list_demos",
    {
      description:
        "List showcase run contracts (Minesweeper, Mona Lisa, …). Returns install + command — does NOT run solvers. For tight loops use glasswarp-demo; for ad-hoc UI use Assist tools (list_rigs, observe, …).",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        format: z
          .enum(["markdown", "json"])
          .optional()
          .describe("markdown (default) or json"),
      },
    },
    async ({ format }) => {
      if (format === "json") {
        return textResult(JSON.stringify({ demos: DEMO_CONTRACTS }, null, 2));
      }
      return textResult(formatDemoIndex());
    },
  );

  server.registerTool(
    "get_demo",
    {
      description:
        "Full showcase run contract: install, command, needs, framing. Does NOT execute the demo. If you can run shell, run the command; otherwise show it to the user. Do not silently fall into a slow MCP click loop.",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        demo_id: z
          .enum(["minesweeper", "mona-lisa", "paint", "notepad"])
          .describe("Showcase id from list_demos"),
        format: z
          .enum(["markdown", "json"])
          .optional()
          .describe("markdown (default) or json"),
      },
    },
    async ({ demo_id, format }) => {
      const d = getDemo(demo_id);
      if (!d) {
        return textResult(
          `Unknown demo_id '${demo_id}'. Call list_demos for ids.`,
          true,
        );
      }
      if (format === "json") {
        return textResult(JSON.stringify(d, null, 2));
      }
      return textResult(formatDemoCard(d));
    },
  );

  server.registerTool(
    "list_rigs",
    {
      description:
        "List the Windows machines (rigs) paired to this account, with online status and whether API access is enabled. Call this first to find a usable rig.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {},
    },
    async () => {
      try {
        const { rigs } = await api.listRigs();
        if (!rigs.length) {
          return textResult(noEligibleRigMessage(), true);
        }
        const lines = rigs.map((r) => {
          const online = r.online ?? r.status === "online";
          const apiOn = !!r.api_access_enabled;
          const usable = online && apiOn ? "USABLE" : "not usable";
          return `- ${r.id}: ${r.machine_name || "unnamed"} · online=${online} · api_access_enabled=${apiOn} · ${usable}`;
        });
        const anyUsable = rigs.some(
          (r) => (r.online ?? r.status === "online") && r.api_access_enabled,
        );
        return textResult(
          [
            "Rigs:",
            ...lines,
            anyUsable
              ? "Pick a USABLE rig_id for start_session."
              : noEligibleRigMessage(),
          ].join("\n"),
          !anyUsable,
        );
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "start_session",
    {
      description:
        "Start a metered desktop session on an online, API-enabled rig. A visible on-screen “API session active” indicator appears on the machine. Sessions bill wall-clock minutes until ended; idle sessions auto-end after ~15 minutes. Always call end_session when the task is done.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        rig_id: z.string().describe("Rig id from list_rigs"),
      },
    },
    async ({ rig_id }) => {
      try {
        const session = await api.createSession(rig_id);
        return textResult(
          [
            `Session started: ${session.session_id}`,
            "A visible “API session active” indicator is on the Windows machine.",
            "The owner can kill the session from the Glasswarp console.",
            "Call observe next, then act. Always call end_session when finished.",
            `Human Live View (owner must be signed into the console): ${liveViewConsoleUrl(session.session_id)}`,
          ].join("\n"),
        );
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "end_session",
    {
      description:
        "End the session, stop billing, restore the desktop state, and clean up apps launched during the session. Always call this when finished or if the task is abandoned.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Session id from start_session"),
      },
    },
    async ({ session_id }) => {
      try {
        await api.endSession(session_id);
        return textResult(`Session ended: ${session_id}. Billing stopped; host safety_restore ran.`);
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "observe",
    {
      description:
        "Capture the current screen state. Returns numbered click targets and a compact text summary (window title + targets). By default also returns a JPEG. For simple verification (did the dialog close? is the field focused?), set image=false — much faster, text/targets only. Request the image when you need to read or judge the screen visually. Observe after every meaningful step — not blindly after every click. If changed=false, do not re-analyze the image. If dirty is null/unavailable, assume changed.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string(),
        max_width: z
          .number()
          .int()
          .min(320)
          .max(3840)
          .optional()
          .describe(
            "Downscale JPEG width for the model (default 1280). For cheap verification frames use 960. Clicks still use native coords.",
          ),
        quality: z
          .number()
          .int()
          .min(40)
          .max(100)
          .optional()
          .describe("JPEG quality 40–100. Verification-grade: ~60."),
        image: z
          .boolean()
          .optional()
          .describe(
            "Include JPEG (default true). Set false for text/targets-only verification — much faster.",
          ),
        mark: z
          .boolean()
          .optional()
          .describe("Overlay numbered targets on the JPEG when available (default true; ignored when image=false)."),
      },
    },
    async ({ session_id, max_width, quality, image, mark }) => {
      try {
        const wantImage = image !== false;
        const obs = await api.observe(session_id, {
          maxWidth: max_width,
          quality,
          mark: mark !== false,
          image: wantImage,
        });
        const targets = obs.targets ?? [];
        const timing = obs.timing;
        const textBlock = obs.text;
        const text = [
          textBlock?.summary
            ? textBlock.summary
            : `Native desktop size: ${obs.native_width}x${obs.native_height}`,
          `Native desktop size: ${obs.native_width}x${obs.native_height} (use these for click_xy — NOT the JPEG pixel size ${obs.width}x${obs.height}).`,
          dirtyHint(obs.dirty, obs.changed),
          wantImage ? `Marked: ${obs.marked ? "yes" : "no"}` : "Image: omitted (image=false)",
          timing
            ? `Timing (ms): total=${timing.total_ms} screenshot_rtt=${timing.screenshot_rtt_ms} targets_rtt=${timing.targets_rtt_ms} host_jpeg=${timing.host_jpeg_ms ?? "n/a"} host_uia=${timing.host_uia_ms ?? "n/a"}`
            : null,
          textBlock?.targets?.length
            ? ["Targets (prefer click_target):", ...textBlock.targets].join("\n")
            : formatTargets(targets),
        ]
          .filter(Boolean)
          .join("\n");

        const content: Array<
          | { type: "image"; data: string; mimeType: string }
          | { type: "text"; text: string }
        > = [{ type: "text" as const, text }];
        if (wantImage && obs.jpeg_base64) {
          content.unshift({
            type: "image" as const,
            data: obs.jpeg_base64,
            mimeType: "image/jpeg",
          });
        }
        return { content };
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "click_target",
    {
      description:
        "Click a numbered target from the most recent observe. Prefer this over click_xy — targets come from Windows UI Automation and are precise. Re-observe first if the screen may have changed since the target was listed.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string(),
        target_id: z.string().describe("Target id from observe"),
        button: z.enum(["left", "right", "middle"]).optional(),
        double: z.boolean().optional().describe("Double-click if true"),
      },
    },
    async ({ session_id, target_id, button, double }) => {
      try {
        const { targets } = await api.listTargets(session_id);
        const t = targets.find((x) => x.id === target_id);
        if (!t) {
          return textResult(
            `Unknown target_id "${target_id}". Call observe again and use an id from that list.`,
            true,
          );
        }
        const { x, y } = targetCenter(t);
        const btn = button ?? "left";
        const click = { type: "mouse_click", x, y, button: btn };
        const events = double ? [click, click] : [click];
        await api.sendInput(session_id, events);
        return textResult(`Clicked target ${target_id} at native (${x},${y}) button=${btn}${double ? " (double)" : ""}. Re-observe next.`);
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "click_xy",
    {
      description:
        "Click at native screen coordinates. Use only when no suitable numbered target exists. Coordinates are native capture space from observe (native_width × native_height) — never the downscaled JPEG pixel size.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string(),
        x: z.number().int().describe("Native X (0…native_width-1)"),
        y: z.number().int().describe("Native Y (0…native_height-1)"),
        button: z.enum(["left", "right", "middle"]).optional(),
        double: z.boolean().optional(),
      },
    },
    async ({ session_id, x, y, button, double }) => {
      try {
        const btn = button ?? "left";
        const click = { type: "mouse_click", x, y, button: btn };
        await api.sendInput(session_id, double ? [click, click] : [click]);
        return textResult(`Clicked native (${x},${y}) button=${btn}${double ? " (double)" : ""}. Re-observe next.`);
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "type_text",
    {
      description:
        "Type text into the currently focused control, as native keyboard input. Click the target field first.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string(),
        text: z.string(),
      },
    },
    async ({ session_id, text }) => {
      try {
        await api.sendInput(session_id, [{ type: "type_text", text }]);
        return textResult(`Typed ${text.length} character(s). Re-observe next.`);
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "send_keys",
    {
      description:
        "Send key combinations or special keys (e.g. enter, tab, ctrl+s, alt+f4, win). Use for shortcuts and navigation.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string(),
        keys: z.string().describe("Key or combo, e.g. enter, ctrl+s, alt+f4"),
      },
    },
    async ({ session_id, keys }) => {
      try {
        const events = keysToEvents(keys);
        if (!events.length) return textResult("Empty keys.", true);
        await api.sendInput(session_id, events);
        return textResult(`Sent keys: ${keys}. Re-observe next.`);
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "drag",
    {
      description:
        "Press, move, and release the mouse in one smooth native motion. Use for drawing, sliders, selection, and drag-and-drop. Coordinates are native capture space.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string(),
        from_x: z.number().int(),
        from_y: z.number().int(),
        to_x: z.number().int(),
        to_y: z.number().int(),
        duration_ms: z
          .number()
          .int()
          .min(0)
          .max(5000)
          .optional()
          .describe("Approx duration; controls intermediate move steps (default ~200ms)."),
      },
    },
    async ({ session_id, from_x, from_y, to_x, to_y, duration_ms }) => {
      try {
        const steps = Math.max(2, Math.min(40, Math.round((duration_ms ?? 200) / 16)));
        const events: Record<string, unknown>[] = [
          { type: "mouse_down", button: "left", x: from_x, y: from_y },
        ];
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          events.push({
            type: "mouse_move",
            x: Math.round(from_x + (to_x - from_x) * t),
            y: Math.round(from_y + (to_y - from_y) * t),
          });
        }
        events.push({ type: "mouse_up", button: "left", x: to_x, y: to_y });
        await api.sendInput(session_id, events);
        return textResult(
          `Dragged native (${from_x},${from_y}) → (${to_x},${to_y}). Re-observe next.`,
        );
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "scroll",
    {
      description: "Scroll at a screen position (native coordinates).",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string(),
        x: z.number().int(),
        y: z.number().int(),
        delta: z
          .number()
          .int()
          .describe("Vertical scroll delta (negative = down / toward bottom of page)."),
      },
    },
    async ({ session_id, x, y, delta }) => {
      try {
        await api.sendInput(session_id, [
          { type: "mouse_move", x, y },
          { type: "mouse_scroll", dx: 0, dy: delta },
        ]);
        return textResult(`Scrolled at native (${x},${y}) dy=${delta}. Re-observe next.`);
      } catch (e) {
        return errResult(e);
      }
    },
  );

  const actionSchema = z.object({
    type: z.enum([
      "click_target",
      "click_xy",
      "type_text",
      "send_keys",
      "drag",
      "scroll",
    ]),
    target_id: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    to_x: z.number().optional(),
    to_y: z.number().optional(),
    button: z.enum(["left", "right", "middle"]).optional(),
    double: z.boolean().optional(),
    text: z.string().optional(),
    keys: z.string().optional(),
    delta: z.number().optional(),
    delay_ms: z
      .number()
      .int()
      .min(0)
      .max(2000)
      .optional()
      .describe("Optional settle delay after this action (0–2000 ms)"),
  });

  server.registerTool(
    "send_actions",
    {
      description:
        "Execute a short sequence of actions in one call. Use when you can predict the next few steps (e.g. click a field, type, press Enter). Prefer observe_after=true so act+verify is ONE round trip. Do not batch across steps whose intermediate state you cannot predict. Max 10 actions; fails fast at the first invalid action (reports index) and does not run the rest.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string(),
        actions: z.array(actionSchema).min(1).max(10),
        observe_after: z
          .boolean()
          .optional()
          .describe(
            "Default true. When true, returns a verification observe in the same tool result.",
          ),
      },
    },
    async ({ session_id, actions, observe_after }) => {
      try {
        if (actions.length > 10) {
          return textResult(
            "Batch too long (max 10 actions). Split the sequence and observe between batches.",
            true,
          );
        }

        const needTargets = actions.some((a) => a.type === "click_target");
        let targets: GroundingTarget[] = [];
        if (needTargets) {
          const listed = await api.listTargets(session_id);
          targets = listed.targets ?? [];
        }

        const events: Record<string, unknown>[] = [];
        for (let i = 0; i < actions.length; i++) {
          const a = actions[i]!;
          const delay = a.delay_ms;
          const withDelay = (ev: Record<string, unknown>) =>
            delay != null ? { ...ev, delay_ms: delay } : ev;

          try {
            switch (a.type) {
              case "click_target": {
                if (!a.target_id) throw new Error("target_id required");
                const t = targets.find((x) => x.id === a.target_id);
                if (!t) {
                  throw new Error(
                    `Unknown target_id "${a.target_id}" — call observe and use an id from that list`,
                  );
                }
                const { x, y } = targetCenter(t);
                const btn = a.button ?? "left";
                events.push(withDelay({ type: "mouse_click", x, y, button: btn }));
                if (a.double) {
                  events.push({ type: "mouse_click", x, y, button: btn });
                }
                break;
              }
              case "click_xy": {
                if (a.x == null || a.y == null) throw new Error("x and y required");
                const btn = a.button ?? "left";
                events.push(
                  withDelay({ type: "mouse_click", x: a.x, y: a.y, button: btn }),
                );
                if (a.double) {
                  events.push({
                    type: "mouse_click",
                    x: a.x,
                    y: a.y,
                    button: btn,
                  });
                }
                break;
              }
              case "type_text": {
                if (a.text == null) throw new Error("text required");
                events.push(withDelay({ type: "type_text", text: a.text }));
                break;
              }
              case "send_keys": {
                if (!a.keys) throw new Error("keys required");
                const keyEvents = keysToEvents(a.keys);
                if (!keyEvents.length) throw new Error("empty keys");
                for (let k = 0; k < keyEvents.length; k++) {
                  const ev = keyEvents[k] as Record<string, unknown>;
                  events.push(k === keyEvents.length - 1 ? withDelay(ev) : ev);
                }
                break;
              }
              case "drag": {
                if (
                  a.x == null ||
                  a.y == null ||
                  a.to_x == null ||
                  a.to_y == null
                ) {
                  throw new Error("x,y,to_x,to_y required");
                }
                events.push({ type: "mouse_move", x: a.x, y: a.y });
                events.push({
                  type: "mouse_down",
                  x: a.x,
                  y: a.y,
                  button: "left",
                });
                events.push({ type: "mouse_move", x: a.to_x, y: a.to_y });
                events.push(
                  withDelay({
                    type: "mouse_up",
                    x: a.to_x,
                    y: a.to_y,
                    button: "left",
                  }),
                );
                break;
              }
              case "scroll": {
                if (a.x == null || a.y == null || a.delta == null) {
                  throw new Error("x,y,delta required");
                }
                events.push({ type: "mouse_move", x: a.x, y: a.y });
                events.push(
                  withDelay({ type: "mouse_scroll", dx: 0, dy: a.delta }),
                );
                break;
              }
              default:
                throw new Error("unsupported action type");
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return textResult(
              `Batch failed at action index ${i} (${a.type}): ${msg}. No actions were sent. Re-observe and re-plan.`,
              true,
            );
          }
        }

        await api.sendInput(session_id, events);
        if (observe_after === false) {
          return textResult(
            `Executed ${actions.length} action(s) (${events.length} low-level event(s)). Call observe to verify.`,
          );
        }

        const obs = await api.observe(session_id, { maxWidth: 1280, mark: true });
        const tlist = obs.targets ?? [];
        const text = [
          `Executed ${actions.length} action(s) (${events.length} events), then observe:`,
          obs.text?.summary ?? "",
          `Native desktop size: ${obs.native_width}x${obs.native_height}.`,
          dirtyHint(obs.dirty, obs.changed),
          obs.text?.targets?.length
            ? ["Targets (prefer click_target):", ...obs.text.targets].join("\n")
            : formatTargets(tlist),
        ]
          .filter(Boolean)
          .join("\n");
        const content: Array<
          | { type: "image"; data: string; mimeType: string }
          | { type: "text"; text: string }
        > = [{ type: "text" as const, text }];
        if (obs.jpeg_base64) {
          content.unshift({
            type: "image" as const,
            data: obs.jpeg_base64,
            mimeType: "image/jpeg",
          });
        }
        return { content };
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "launch_app",
    {
      description:
        "Launch an application on the rig (e.g. notepad.exe, mspaint.exe, or an absolute path). Optional args are passed to the process (needed for Chrome + URL demos). Apps launched this way are tracked and closed automatically at session end.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string(),
        path_or_name: z.string().describe("Executable name or absolute path"),
        args: z
          .array(z.string())
          .optional()
          .describe(
            'Optional process args, e.g. ["--new-window", "https://www.google.com/fbx?fbx=minesweeper"]',
          ),
      },
    },
    async ({ session_id, path_or_name, args }) => {
      try {
        const res = await api.launchApp(session_id, path_or_name, args ?? []);
        const argNote = args?.length ? ` args=${JSON.stringify(args)}` : "";
        return textResult(
          `Launched ${path_or_name}${argNote}${res.pid != null ? ` (pid ${res.pid})` : ""}. Re-observe next.`,
        );
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "get_live_view_url",
    {
      description:
        "Get a URL where a human (the rig owner) can watch this session live at 60fps from the Glasswarp console. Offer this when starting long or sensitive tasks so they can supervise and intervene. Requires the owner to be signed into the console.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string(),
      },
    },
    async ({ session_id }) => {
      try {
        // Confirm session exists for this key before advertising a URL.
        await api.getSession(session_id);
        const url = liveViewConsoleUrl(session_id);
        return textResult(
          [
            `Live View (owner console): ${url}`,
            "The machine owner must be signed into Glasswarp to open Live View.",
            "API keys alone cannot open the console player — this preserves owner consent.",
          ].join("\n"),
        );
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "get_session_status",
    {
      description:
        "Get session status including duration signals useful for telling the user about metered time.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string(),
      },
    },
    async ({ session_id }) => {
      try {
        const s = await api.getSession(session_id);
        return textResult(
          JSON.stringify(
            {
              session_id: s.session_id,
              status: s.status,
              host_id: s.host_id,
              mode: s.mode,
              capture_mode: s.capture_mode ?? "unknown",
              created_at: s.created_at,
              action_count: s.action_count,
              billed_minutes: s.billed_minutes,
            },
            null,
            2,
          ),
        );
      } catch (e) {
        return errResult(e);
      }
    },
  );

  return server;
}
