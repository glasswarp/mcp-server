/**
 * Methods Glama (and similar directories) use for health / catalog probes.
 * These must succeed without a Bearer key. Any other method stays 401.
 */
const UNAUTHENTICATED_METHODS = new Set([
  "initialize",
  "notifications/initialized",
  "ping",
  "tools/list",
  "resources/list",
  "resources/templates/list",
  "resources/read",
  "prompts/list",
  "prompts/get",
]);

function methodsFromBody(body: unknown): string[] {
  const msgs = Array.isArray(body) ? body : [body];
  const out: string[] = [];
  for (const msg of msgs) {
    if (msg && typeof msg === "object" && "method" in msg) {
      const m = (msg as { method?: unknown }).method;
      if (typeof m === "string" && m.length) out.push(m);
    }
  }
  return out;
}

/** True when every JSON-RPC message is a discovery/health method (or body is empty). */
export function allowsUnauthenticatedDiscovery(body: unknown): boolean {
  const methods = methodsFromBody(body);
  if (!methods.length) return false;
  return methods.every((m) => UNAUTHENTICATED_METHODS.has(m));
}
