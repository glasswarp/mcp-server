import type { Request } from "express";

/** Mask for logs — never print a full API key. */
export function redactKey(key: string): string {
  if (key.length <= 12) return "***";
  return `${key.slice(0, 10)}…${key.slice(-4)}`;
}

/**
 * Extract Glasswarp API key from Authorization: Bearer <key>.
 * Returns null if missing/malformed.
 */
export function extractBearerApiKey(req: Request): string | null {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header) return null;
  const m = /^Bearer\s+(\S+)/i.exec(header.trim());
  if (!m?.[1]) return null;
  const key = m[1].trim();
  if (!key.startsWith("gw_")) return null;
  return key;
}
