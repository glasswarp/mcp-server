/**
 * Showcase run contracts — Assist / Showcase / Build.
 *
 * Tools return these cards; they do NOT execute solvers (brain stays example code).
 * Keep in sync with sdk/python/glasswarp/demos/cli.py catalog.
 */

export type DemoRunContract = {
  id: string;
  title: string;
  summary: string;
  framing: string;
  when: string;
  not: string;
  install: string;
  command: string;
  command_alt: string;
  repo_fallback: string;
  needs: string[];
  docs_url: string;
  prompt: string;
};

export const DEMO_CONTRACTS: DemoRunContract[] = [
  {
    id: "minesweeper",
    title: "Minesweeper",
    summary:
      "Clear Google Minesweeper on a real Windows PC at click-speed (CV + deterministic solver).",
    framing:
      'Say: "an agent solved Minesweeper on a real PC through the Glasswarp API" — never "Glasswarp solved Minesweeper."',
    when: "Tight observe→decide→act loop (many rounds). Decide must be local code, not an LLM turn per cell.",
    not: "Do not play cell-by-cell via MCP observe/click with the model — ~100× slower.",
    install: 'pip install "glasswarp[demos]"',
    command: "glasswarp-demo minesweeper",
    command_alt: "python -m glasswarp.demos minesweeper",
    repo_fallback: "cd sdk/python && python examples/minesweeper_solver_demo.py",
    needs: [
      "GLASSWARP_API_KEY (same key as MCP)",
      "Online rig with API access enabled",
      "Chrome on the Windows host (demo launches it)",
    ],
    docs_url: "https://docs.glasswarp.com/examples/minesweeper",
    prompt: "demo_minesweeper",
  },
  {
    id: "mona-lisa",
    title: "Mona Lisa (Paint)",
    summary:
      "Paint a ~40×60 / 18-color Mona Lisa mosaic in Microsoft Paint and save it to the Desktop.",
    framing:
      'Say: "an agent painted the Mona Lisa on a real PC through the Glasswarp API" — never "Glasswarp painted it."',
    when: "Many paint/fill steps — use the packaged mosaic planner, not an LLM brush loop.",
    not: "Do not re-implement the mosaic tile-by-tile via MCP drag/click unless the demo cannot run.",
    install: 'pip install "glasswarp[demos]"',
    command: "glasswarp-demo mona-lisa",
    command_alt: "python -m glasswarp.demos mona-lisa",
    repo_fallback: "cd sdk/python && python examples/paint_mona_lisa_demo.py",
    needs: [
      "GLASSWARP_API_KEY (same key as MCP)",
      "Online rig with API access enabled",
      "mspaint.exe on the Windows host",
    ],
    docs_url: "https://docs.glasswarp.com/examples/mona-lisa",
    prompt: "demo_mona_lisa",
  },
  {
    id: "paint",
    title: "Paint mark",
    summary: "Draw a themed GLASSWARP outline in Paint with native drag.",
    framing:
      'Say: "an agent drew in Paint through the Glasswarp API."',
    when: "Short native-drag showcase when you want Paint without the full Mona mosaic.",
    not: "Optional; prefer mona-lisa for the flagship Paint story.",
    install: 'pip install "glasswarp[demos]"',
    command: "glasswarp-demo paint",
    command_alt: "python -m glasswarp.demos paint",
    repo_fallback: "cd sdk/python && python examples/paint_mark_demo.py",
    needs: [
      "GLASSWARP_API_KEY",
      "Online rig with API access enabled",
    ],
    docs_url: "https://docs.glasswarp.com/examples/paint",
    prompt: "demo_mona_lisa",
  },
  {
    id: "notepad",
    title: "Notepad (UIA)",
    summary: "Type into Notepad via Windows UI Automation targets.",
    framing:
      'Say: "an agent typed in Notepad through the Glasswarp API."',
    when: "Quick UIA grounding check; also fine as a short MCP Assist session.",
    not: "For exploratory typing, Assist (MCP tools) is equally fine.",
    install: 'pip install "glasswarp[demos]"',
    command: "glasswarp-demo notepad",
    command_alt: "python -m glasswarp.demos notepad",
    repo_fallback: "cd sdk/python && python examples/notepad_uia_demo.py",
    needs: [
      "GLASSWARP_API_KEY",
      "Online rig with API access enabled",
    ],
    docs_url: "https://docs.glasswarp.com/examples/notepad",
    prompt: "best_practices",
  },
];

export const DEMOS_INDEX_URI = "glasswarp://demos";
export const demoUri = (id: string) => `glasswarp://demos/${id}`;

export function getDemo(id: string): DemoRunContract | undefined {
  return DEMO_CONTRACTS.find((d) => d.id === id);
}

export function formatDemoCard(d: DemoRunContract): string {
  return [
    `# Showcase: ${d.title} (\`${d.id}\`)`,
    "",
    d.summary,
    "",
    d.framing,
    "",
    "## When to use",
    d.when,
    "",
    "## Do not",
    d.not,
    "",
    "## Run (client machine with API key)",
    "```bash",
    d.install,
    "export GLASSWARP_API_KEY=gw_live_sk_...",
    d.command,
    `# or: ${d.command_alt}`,
    "```",
    "",
    "Repo checkout fallback:",
    "```bash",
    d.repo_fallback,
    "```",
    "",
    "## Needs",
    ...d.needs.map((n) => `- ${n}`),
    "",
    "## If you cannot run shell commands",
    "Show the user the install + command block above (or the console/docs page).",
    "Do **not** silently fall into a slow MCP observe/click loop unless they insist.",
    "",
    `Docs: ${d.docs_url}`,
    `MCP prompt (optional): ${d.prompt}`,
    "Guide: https://docs.glasswarp.com/guides/ways-to-run-agents",
  ].join("\n");
}

export function formatDemoIndex(): string {
  const lines = [
    "# Glasswarp showcases (run contracts)",
    "",
    "These are **packaged agent brains** (example/customer code). Glasswarp is eyes and hands only.",
    "Call `get_demo` with an id, or read `glasswarp://demos/{id}`.",
    "",
    "| id | title | command |",
    "| --- | --- | --- |",
    ...DEMO_CONTRACTS.map(
      (d) => `| \`${d.id}\` | ${d.title} | \`${d.command}\` |`,
    ),
    "",
    "Offer these commands for matching showcases; do not impose. Short tasks stay on MCP tools.",
    "Guide: https://docs.glasswarp.com/guides/ways-to-run-agents",
  ];
  return lines.join("\n");
}
