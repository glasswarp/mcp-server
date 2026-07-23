/**
 * Glasswarp remote MCP server (Streamable HTTP).
 *
 * Auth: Authorization: Bearer <glasswarp_api_key>
 * Spec: https://modelcontextprotocol.io — Streamable HTTP, stateless.
 */
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";

import { extractBearerApiKey, redactKey } from "./auth.js";
import { createGlasswarpMcpServer } from "./tools.js";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";

// DNS-rebinding protection (MCP SDK). Must include every public Host clients use.
const allowedHosts = (
  process.env.MCP_ALLOWED_HOSTS ||
  "mcp.glasswarp.com,glasswarp-mcp.fly.dev,localhost,127.0.0.1"
)
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

const app = createMcpExpressApp({
  host: HOST,
  allowedHosts,
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, service: "glasswarp-mcp" });
});

// Cursor probes OAuth discovery for remote MCP. We auth with Bearer API keys
// only — return 404 so clients fall back to configured Authorization headers.
for (const path of [
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/.well-known/openid-configuration",
  "/register",
]) {
  app.all(path, (_req, res) => {
    res.status(404).json({ error: "oauth_not_supported" });
  });
}

app.post("/mcp", async (req, res) => {
  const apiKey = extractBearerApiKey(req);
  if (!apiKey) {
    // No WWW-Authenticate / resource_metadata — avoid triggering Cursor's OAuth dance.
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message:
          "Unauthorized — send Authorization: Bearer <glasswarp_api_key> (create a key at https://www.glasswarp.com/console).",
      },
      id: null,
    });
    return;
  }

  // Never log the full key.
  console.info(`[mcp] request key=${redactKey(apiKey)}`);

  const server = createGlasswarpMcpServer(apiKey);
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
  } catch (error) {
    console.error("[mcp] handler error", error instanceof Error ? error.message : error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed — use HTTP POST for Streamable HTTP MCP.",
    },
    id: null,
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

app.listen(PORT, HOST, () => {
  console.info(
    `[mcp] Glasswarp MCP listening on http://${HOST}:${PORT}/mcp (stateless Streamable HTTP)`,
  );
});
