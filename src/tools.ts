import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import {
  ApiError,
  GlasswarpApi,
  liveViewConsoleUrl,
  noEligibleRigMessage,
  type GroundingTarget,
  type ObservePayload,
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
import {
  resolveImageEncodeOpts,
  resolveWantImage,
  shapeObserveResult,
  type ObserveShapeResult,
} from "./observe-shape.js";

/** Legacy URIs — same content as ways-to-run-agents. */
const LEGACY_ASSIST_SHOWCASE_URI = "glasswarp://guide/assist-showcase-build";
const LEGACY_MCP_VS_SDK_URI = "glasswarp://guide/mcp-vs-sdk";

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    isError,
  };
}

/** Thrown when a directory probe hits an API tool without a Bearer key. */
export class AuthRequiredError extends Error {
  constructor() {
    super(
      "Unauthorized — send Authorization: Bearer <glasswarp_api_key> (create a key at https://www.glasswarp.com/console).",
    );
    this.name = "AuthRequiredError";
  }
}

function errResult(err: unknown) {
  if (err instanceof AuthRequiredError) {
    return textResult(err.message, true);
  }
  if (err instanceof ApiError) {
    const extras: string[] = [];
    if (err.body) {
      for (const key of [
        "code",
        "executed",
        "aborted",
        "aborted_at",
        "total",
        "action_count",
        "kill_to_abort_ms",
      ] as const) {
        const v = err.body[key];
        if (v !== undefined && v !== null) extras.push(`${key}=${v}`);
      }
    }
    const suffix = extras.length ? ` (${extras.join(", ")})` : "";
    return textResult(`[${err.status}] ${err.message}${suffix}`, true);
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

function shapeFromApiObserve(
  obs: ObservePayload,
  opts: { wantImage: boolean; prefixLines?: string[] },
): ObserveShapeResult {
  const targets = obs.targets ?? [];
  const timing = obs.timing;
  const textBlock = obs.text;
  return shapeObserveResult({
    wantImage: opts.wantImage,
    changed: obs.changed,
    dirty: obs.dirty,
    jpeg_base64: obs.jpeg_base64,
    native_width: obs.native_width,
    native_height: obs.native_height,
    width: obs.width,
    height: obs.height,
    marked: obs.marked,
    textSummary: textBlock?.summary,
    textTargets: textBlock?.targets,
    targetsFormatted: formatTargets(targets),
    timingLine: timing
      ? `Timing (ms): total=${timing.total_ms} screenshot_rtt=${timing.screenshot_rtt_ms} targets_rtt=${timing.targets_rtt_ms} host_jpeg=${timing.host_jpeg_ms ?? "n/a"} host_uia=${timing.host_uia_ms ?? "n/a"}`
      : null,
    prefixLines: opts.prefixLines,
  });
}

function mcpObserveContent(
  shaped: ObserveShapeResult,
  jpeg_base64?: string | null,
): {
  content: Array<
    | { type: "image"; data: string; mimeType: string }
    | { type: "text"; text: string }
  >;
} {
  const content: Array<
    | { type: "image"; data: string; mimeType: string }
    | { type: "text"; text: string }
  > = [{ type: "text" as const, text: shaped.text }];
  if (shaped.includeImage && jpeg_base64) {
    content.unshift({
      type: "image" as const,
      data: jpeg_base64,
      mimeType: "image/jpeg",
    });
  }
  return { content };
}

/** Real client, or a gate that rejects any API call (anonymous discovery only). */
function glasswarpApiOrAuthGate(apiKey: string | null): GlasswarpApi {
  if (apiKey) return new GlasswarpApi(apiKey);
  return new Proxy({} as GlasswarpApi, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      return () => Promise.reject(new AuthRequiredError());
    },
  });
}

export function createGlasswarpMcpServer(apiKey: string | null): McpServer {
  const api = glasswarpApiOrAuthGate(apiKey);
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
        "List showcase run contracts (id, title, install, command). Read-only catalog — does NOT start a session, touch a rig, or run solvers. Use when the user asks for Minesweeper/Mona Lisa/Paint demos or you need the glasswarp-demo command. Prefer get_demo for one full card. For ad-hoc UI work use list_rigs → start_session → observe instead.",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        format: z
          .enum(["markdown", "json"])
          .optional()
          .describe("Response format: markdown (default) or json"),
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
        "Return one showcase run contract (install, command, needs, framing). Does NOT execute the demo or control a PC. Call after list_demos when you know the demo_id. If the client can run shell, offer the command; if chat-only, show the card. Do not replace this with a slow MCP click loop for solver demos.",
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        demo_id: z
          .enum(["minesweeper", "mona-lisa", "paint", "notepad"])
          .describe("Showcase id from list_demos"),
        format: z
          .enum(["markdown", "json"])
          .optional()
          .describe("Response format: markdown (default) or json"),
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
        "List Windows machines (rigs) paired to this API key: id, name, online, api_access_enabled, and USABLE flag. Read-only — does not start a session. Call first before start_session. A rig is USABLE only when online AND the owner enabled API access. If none are USABLE, tell the user to install the host agent, pair in Console → Rigs, and enable API access — never ask for OS passwords.",
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
        "Start a metered desktop session on a USABLE rig from list_rigs. Side effects: begins wall-clock billing, shows an on-screen “API session active” indicator, enables observe/input until end_session. Idle sessions auto-end after ~15 minutes. Always call end_session when done or abandoning. Do not call if no USABLE rig exists. Returns session_id and Live View URL (owner console login required).",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        rig_id: z
          .string()
          .describe("Rig id from list_rigs (must be online with api_access_enabled)"),
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
        "End an active session. Side effects: stops billing, runs host safety_restore, closes apps launched via launch_app. Always call when finished or abandoning — do not leave sessions open. Safe to call once; further observe/input on that session_id will fail.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Session id returned by start_session"),
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
        "Read the current screen: UIA targets (numbered ids + native coords) and a text summary. Does not move mouse/keyboard. Default image=false (no JPEG) for speed; set image=true only when you must judge pixels visually (then max_width≈960, quality≈60). If changed=false, JPEG is omitted even when requested — do not re-analyze; wait or act differently. If dirty is null, assume changed. Prefer send_actions for multi-step UI; observe after meaningful steps, not after every click. Target ids are valid only until the next UI change.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Active session id from start_session"),
        max_width: z
          .number()
          .int()
          .min(320)
          .max(3840)
          .optional()
          .describe(
            "JPEG max width when image=true (default 960). Clicks always use native coords, not JPEG pixels.",
          ),
        quality: z
          .number()
          .int()
          .min(40)
          .max(100)
          .optional()
          .describe("JPEG quality 40–100 when image=true (default 60)"),
        image: z
          .boolean()
          .optional()
          .describe(
            "Include JPEG (default false). True only to visually read/judge the screen.",
          ),
        mark: z
          .boolean()
          .optional()
          .describe(
            "Overlay numbered targets on JPEG when image=true (default true; ignored if image=false)",
          ),
      },
    },
    async ({ session_id, max_width, quality, image, mark }) => {
      try {
        const wantImage = resolveWantImage(image);
        const encode = resolveImageEncodeOpts({
          wantImage,
          maxWidth: max_width,
          quality,
          mark,
        });
        const obs = await api.observe(session_id, {
          maxWidth: encode.maxWidth,
          quality: encode.quality,
          mark: encode.mark,
          image: wantImage,
        });
        const shaped = shapeFromApiObserve(obs, { wantImage });
        return mcpObserveContent(shaped, obs.jpeg_base64);
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "click_target",
    {
      description:
        "Left/right/middle-click a UIA target by id from the latest observe (uses native center coords). Prefer over click_xy. Side effect: real mouse click on the remote Windows desktop. Do not reuse target_id after the screen may have changed — re-observe first. For click→type→keys sequences, use send_actions (one turn) instead of chaining this tool.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Active session id"),
        target_id: z
          .string()
          .describe("Target id from the most recent observe (e.g. uia-… )"),
        button: z
          .enum(["left", "right", "middle"])
          .optional()
          .describe("Mouse button (default left)"),
        double: z
          .boolean()
          .optional()
          .describe("If true, double-click (two clicks)"),
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
        "Click at native screen coordinates (0…native_width-1, 0…native_height-1 from observe). Last resort when no suitable UIA target exists — prefer click_target. Never use JPEG/downscaled pixel coords. Side effect: real mouse click on the remote desktop.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Active session id"),
        x: z.number().int().describe("Native X (0…native_width-1)"),
        y: z.number().int().describe("Native Y (0…native_height-1)"),
        button: z
          .enum(["left", "right", "middle"])
          .optional()
          .describe("Mouse button (default left)"),
        double: z
          .boolean()
          .optional()
          .describe("If true, double-click"),
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
        "Type a Unicode string into the currently focused control via native input. Does not click first — focus the field (click_target / send_actions) before calling. Side effect: keystrokes on the remote desktop. For form fills (click → type → tab/enter), prefer send_actions in one call.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Active session id"),
        text: z.string().describe("Literal text to type (not a key combo)"),
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
        "Send a key or chord to the focused window (e.g. enter, tab, ctrl+s, alt+f4, win). Side effect: real key events on the remote desktop. Prefer bundling into send_actions when the shortcut follows a click/type in the same planned sequence. Use type_text for literal strings, not this tool.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Active session id"),
        keys: z
          .string()
          .describe("Key or combo, e.g. enter, tab, ctrl+s, alt+f4, win"),
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
        "Press-move-release mouse drag in native capture coordinates. Use for drawing, sliders, selection boxes, and drag-and-drop. Side effect: mouse_down → moves → mouse_up on the remote desktop. Prefer send_actions if the drag is one step in a longer predictable sequence.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Active session id"),
        from_x: z.number().int().describe("Native start X"),
        from_y: z.number().int().describe("Native start Y"),
        to_x: z.number().int().describe("Native end X"),
        to_y: z.number().int().describe("Native end Y"),
        duration_ms: z
          .number()
          .int()
          .min(0)
          .max(5000)
          .optional()
          .describe("Approx drag duration in ms; more steps when larger (default ~200)"),
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
      description:
        "Move the cursor to native (x,y) then apply a vertical mouse-wheel delta. Side effect: scroll on whatever is under that point. Negative delta scrolls toward the bottom of the page. Prefer send_actions when scroll is part of a multi-step sequence. Re-observe after scrolling lists/pages before clicking targets.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Active session id"),
        x: z.number().int().describe("Native X to hover before scrolling"),
        y: z.number().int().describe("Native Y to hover before scrolling"),
        delta: z
          .number()
          .int()
          .describe("Vertical wheel delta (negative = toward bottom of page)"),
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
        "PREFERRED multi-step tool: run 1–10 predictable UI actions in one call (click_target, click_xy, type_text, send_keys, drag, scroll). Side effects: all actions execute on the remote desktop; fails fast before sending if any action is invalid. observe_after defaults true (verification observe: text+targets; set observe_image=true for JPEG). Do not batch across unpredictable waits (page loads, installers, modals) — single-step those. Prefer this over chaining solo click/type/keys tools.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Active session id"),
        actions: z
          .array(actionSchema)
          .min(1)
          .max(10)
          .describe("Ordered actions (max 10); click_target needs target_id from latest observe"),
        observe_after: z
          .boolean()
          .optional()
          .describe(
            "Default true. When true, return a verification observe in the same result",
          ),
        observe_image: z
          .boolean()
          .optional()
          .describe(
            "Default false. When true with observe_after, include verification JPEG unless changed=false",
          ),
      },
    },
    async ({ session_id, actions, observe_after, observe_image }) => {
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

        const wantImage = resolveWantImage(observe_image);
        const encode = resolveImageEncodeOpts({ wantImage });
        const obs = await api.observe(session_id, {
          maxWidth: encode.maxWidth,
          quality: encode.quality,
          mark: encode.mark,
          image: wantImage,
        });
        const shaped = shapeFromApiObserve(obs, {
          wantImage,
          prefixLines: [
            `Executed ${actions.length} action(s) (${events.length} events), then observe:`,
          ],
        });
        return mcpObserveContent(shaped, obs.jpeg_base64);
      } catch (e) {
        return errResult(e);
      }
    },
  );

  server.registerTool(
    "launch_app",
    {
      description:
        "Launch an executable on the remote Windows rig (name on PATH or absolute path), optional args. Side effects: starts a process; Glasswarp tracks it and closes it on end_session. Use for notepad.exe, mspaint.exe, chrome with URL args, etc. Wait/re-observe after launch before clicking — do not assume the window is focused immediately.",
      annotations: { destructiveHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Active session id"),
        path_or_name: z
          .string()
          .describe("Executable name (e.g. notepad.exe) or absolute path"),
        args: z
          .array(z.string())
          .optional()
          .describe(
            'Process args, e.g. ["--new-window", "https://example.com"]',
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
        "Return the console Live View URL (≈60fps) for the rig owner to watch and intervene. Read-only for the agent — does not grant the API key console access. Offer on long or sensitive tasks. Owner must be signed into Glasswarp; API keys alone cannot open the player.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Active session id"),
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
        "Fetch session metadata: status, host, mode, created_at, action_count, billed_minutes. Read-only — no input side effects. Use to tell the user about metered time or confirm the session is still active before more actions.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        session_id: z.string().describe("Session id from start_session"),
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
