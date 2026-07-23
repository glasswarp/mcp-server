/** Parse "ctrl+s" / "alt+f4" / "enter" into Platform API key events. */
export function keysToEvents(keys: string): Record<string, unknown>[] {
  const raw = keys.trim();
  if (!raw) return [];
  const parts = raw.split("+").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    return [{ type: "key_press", key: normalizeKey(parts[0]!) }];
  }
  const mods = parts.slice(0, -1).map(normalizeKey);
  const key = normalizeKey(parts[parts.length - 1]!);
  const events: Record<string, unknown>[] = [];
  for (const m of mods) events.push({ type: "key_down", key: m });
  events.push({ type: "key_press", key });
  for (const m of [...mods].reverse()) events.push({ type: "key_up", key: m });
  return events;
}

function normalizeKey(k: string): string {
  const lower = k.toLowerCase();
  const map: Record<string, string> = {
    ctrl: "Control",
    control: "Control",
    alt: "Alt",
    shift: "Shift",
    win: "Meta",
    meta: "Meta",
    cmd: "Meta",
    enter: "Enter",
    return: "Enter",
    tab: "Tab",
    esc: "Escape",
    escape: "Escape",
    space: " ",
    backspace: "Backspace",
    delete: "Delete",
  };
  if (map[lower]) return map[lower]!;
  if (k.length === 1) return k;
  return k.charAt(0).toUpperCase() + k.slice(1);
}
