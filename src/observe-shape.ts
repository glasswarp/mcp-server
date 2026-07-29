/**
 * MCP observe response shaping (Wave 1 — no new Platform endpoints).
 *
 * Goals: default to text+targets (no JPEG), verification-grade images when
 * requested, and never ship a JPEG when dirty proves unchanged.
 */

export const MCP_VERIFY_MAX_WIDTH = 960;
export const MCP_VERIFY_QUALITY = 60;

export type DirtyHint = {
  rects?: number[][];
  empty?: boolean;
} | null | undefined;

export type ObserveShapeInput = {
  /** Caller asked for a JPEG (after applying tool defaults). */
  wantImage: boolean;
  /** Platform `changed` — false only when dirty was available and empty. */
  changed?: boolean;
  dirty?: DirtyHint;
  jpeg_base64?: string | null;
  native_width: number;
  native_height: number;
  width?: number;
  height?: number;
  marked?: boolean;
  textSummary?: string | null;
  textTargets?: string[] | null;
  targetsFormatted: string;
  timingLine?: string | null;
  /** Optional prefix lines (e.g. send_actions execution summary). */
  prefixLines?: string[];
};

export type ObserveShapeResult = {
  /** Whether a JPEG content block should be included. */
  includeImage: boolean;
  /** Why the image was omitted when the caller wanted one. */
  imageOmitReason: string | null;
  text: string;
  /** Approx MCP image payload bytes (base64 length) when included. */
  imageBase64Bytes: number;
  textBytes: number;
};

/**
 * Dirty metadata available and empty ⇒ unchanged. Missing dirty ⇒ assume changed
 * (never treat as a reason to omit a requested image).
 */
export function isProvenUnchanged(
  changed: boolean | undefined,
  dirty: DirtyHint,
): boolean {
  if (dirty == null) return false;
  if (changed === false) return true;
  const rects = dirty.rects ?? [];
  if (dirty.empty === true || rects.length === 0) return true;
  return false;
}

/** Resolve whether to ask the Platform API for a JPEG. */
export function resolveWantImage(imageParam: boolean | undefined): boolean {
  // Opt-in: default false (text + targets only).
  return imageParam === true;
}

/**
 * When a JPEG is requested, use verification-grade defaults unless the caller
 * overrode max_width / quality.
 */
export function resolveImageEncodeOpts(opts: {
  wantImage: boolean;
  maxWidth?: number;
  quality?: number;
  mark?: boolean;
}): { maxWidth?: number; quality?: number; mark: boolean } {
  if (!opts.wantImage) {
    return { mark: false };
  }
  return {
    maxWidth: opts.maxWidth ?? MCP_VERIFY_MAX_WIDTH,
    quality: opts.quality ?? MCP_VERIFY_QUALITY,
    mark: opts.mark !== false,
  };
}

export function dirtyHint(dirty: DirtyHint, changed?: boolean): string {
  if (dirty == null) {
    return "dirty: unavailable (assume changed) — do not treat as unchanged; re-check visually if unsure.";
  }
  if (changed === false) {
    return "changed: false — no visual change since last dirty take; do not re-analyze; JPEG omitted if requested.";
  }
  const rects = dirty.rects ?? [];
  if (dirty.empty === true || rects.length === 0) {
    return "changed: false — little or no visual change since last dirty take; skip re-analysis if your last observe is still valid; JPEG omitted if requested.";
  }
  return `changed: true — ${rects.length} dirty rectangle(s) since last take.`;
}

/**
 * Build MCP text (+ decide image inclusion) for an observe-shaped tool result.
 */
export function shapeObserveResult(input: ObserveShapeInput): ObserveShapeResult {
  const provenUnchanged = isProvenUnchanged(input.changed, input.dirty);
  const includeImage =
    input.wantImage &&
    !provenUnchanged &&
    Boolean(input.jpeg_base64);

  let imageOmitReason: string | null = null;
  if (input.wantImage && !includeImage) {
    if (provenUnchanged) {
      imageOmitReason =
        "Image: omitted (changed=false — screen unchanged; do not re-analyze). Set image=true on a later observe if the UI may have updated.";
    } else if (!input.jpeg_base64) {
      imageOmitReason = "Image: omitted (no JPEG from host).";
    }
  }

  const imageLine = includeImage
    ? `Marked: ${input.marked ? "yes" : "no"}`
    : input.wantImage
      ? imageOmitReason
      : "Image: omitted (image=false — text/targets only). Set image=true to read the screen visually.";

  const text = [
    ...(input.prefixLines ?? []),
    input.textSummary ||
      `Native desktop size: ${input.native_width}x${input.native_height}`,
    `Native desktop size: ${input.native_width}x${input.native_height} (use these for click_xy — NOT the JPEG pixel size ${input.width ?? "n/a"}x${input.height ?? "n/a"}).`,
    dirtyHint(input.dirty, input.changed),
    imageLine,
    input.timingLine ?? null,
    input.textTargets?.length
      ? ["Targets (prefer click_target):", ...input.textTargets].join("\n")
      : input.targetsFormatted,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    includeImage,
    imageOmitReason,
    text,
    imageBase64Bytes: includeImage && input.jpeg_base64 ? input.jpeg_base64.length : 0,
    textBytes: Buffer.byteLength(text, "utf8"),
  };
}
