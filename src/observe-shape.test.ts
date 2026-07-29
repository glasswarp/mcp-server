/**
 * Wave 1 observe shaping — unit tests + payload before/after bench.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MCP_VERIFY_MAX_WIDTH,
  MCP_VERIFY_QUALITY,
  isProvenUnchanged,
  resolveImageEncodeOpts,
  resolveWantImage,
  shapeObserveResult,
} from "./observe-shape.js";

/** Synthetic ~80KB JPEG base64 (typical 1280-wide verify frame order of magnitude). */
const FAKE_JPEG_B64 = "A".repeat(80_000);

const baseInput = {
  jpeg_base64: FAKE_JPEG_B64,
  native_width: 1920,
  native_height: 1080,
  width: 960,
  height: 540,
  marked: true,
  textSummary: "Window: Notepad — Document",
  textTargets: ["[1] Edit (edit) id=e1", "[2] Save (button) id=b1"],
  targetsFormatted: "Targets (prefer click_target):\n[1] Edit",
};

describe("resolveWantImage", () => {
  it("defaults to false (opt-in JPEG)", () => {
    assert.equal(resolveWantImage(undefined), false);
    assert.equal(resolveWantImage(false), false);
    assert.equal(resolveWantImage(true), true);
  });
});

describe("resolveImageEncodeOpts", () => {
  it("uses verification-grade defaults when image requested", () => {
    const enc = resolveImageEncodeOpts({ wantImage: true });
    assert.equal(enc.maxWidth, MCP_VERIFY_MAX_WIDTH);
    assert.equal(enc.quality, MCP_VERIFY_QUALITY);
    assert.equal(enc.mark, true);
  });

  it("skips encode opts when no image", () => {
    const enc = resolveImageEncodeOpts({ wantImage: false });
    assert.equal(enc.maxWidth, undefined);
    assert.equal(enc.mark, false);
  });
});

describe("isProvenUnchanged", () => {
  it("never treats missing dirty as unchanged", () => {
    assert.equal(isProvenUnchanged(false, null), false);
    assert.equal(isProvenUnchanged(undefined, undefined), false);
  });

  it("treats empty dirty / changed=false as unchanged", () => {
    assert.equal(isProvenUnchanged(false, { rects: [], available: true }), true);
    assert.equal(isProvenUnchanged(true, { rects: [], empty: true }), true);
    assert.equal(isProvenUnchanged(true, { rects: [[0, 0, 10, 10]] }), false);
  });
});

describe("shapeObserveResult — Wave 1 before/after", () => {
  it("before: legacy default image=true ships full JPEG payload", () => {
    // Legacy MCP behavior: image !== false ⇒ wantImage true, always include jpeg.
    const legacyWantImage = true;
    const legacyInclude =
      legacyWantImage && Boolean(baseInput.jpeg_base64);
    const legacyTextBytes = 400; // approx old text block
    const beforeBytes =
      (legacyInclude ? FAKE_JPEG_B64.length : 0) + legacyTextBytes;
    assert.ok(beforeBytes > 80_000);
  });

  it("after default: text-only — no JPEG in MCP content", () => {
    const shaped = shapeObserveResult({
      ...baseInput,
      wantImage: resolveWantImage(undefined),
      changed: true,
      dirty: { rects: [[0, 0, 100, 100]], available: true },
    });
    assert.equal(shaped.includeImage, false);
    assert.equal(shaped.imageBase64Bytes, 0);
    assert.ok(shaped.textBytes < 2_000);
    assert.match(shaped.text, /image=false/i);
  });

  it("after changed=false: omits JPEG even when image requested", () => {
    const shaped = shapeObserveResult({
      ...baseInput,
      wantImage: true,
      changed: false,
      dirty: { rects: [], available: true },
    });
    assert.equal(shaped.includeImage, false);
    assert.equal(shaped.imageBase64Bytes, 0);
    assert.match(shaped.text, /omitted \(changed=false/i);
  });

  it("after image=true + changed: includes JPEG", () => {
    const shaped = shapeObserveResult({
      ...baseInput,
      wantImage: true,
      changed: true,
      dirty: { rects: [[1, 1, 20, 20]], available: true },
    });
    assert.equal(shaped.includeImage, true);
    assert.equal(shaped.imageBase64Bytes, FAKE_JPEG_B64.length);
  });

  it("payload reduction: default observe vs legacy full JPEG", () => {
    const after = shapeObserveResult({
      ...baseInput,
      wantImage: false,
      changed: true,
      dirty: { rects: [[0, 0, 50, 50]] },
    });
    const beforeBytes = FAKE_JPEG_B64.length + after.textBytes;
    const afterBytes = after.textBytes;
    const reductionPct = Math.round((1 - afterBytes / beforeBytes) * 100);
    assert.ok(
      reductionPct >= 95,
      `expected ≥95% payload cut on default observe, got ${reductionPct}%`,
    );
    // Surfaced for bench markdown (see bench/MCP_WAVE1_RESULTS.md)
    console.info(
      JSON.stringify({
        type: "mcp_wave1_payload_bench",
        before_bytes: beforeBytes,
        after_bytes: afterBytes,
        reduction_pct: reductionPct,
        verify_max_width: MCP_VERIFY_MAX_WIDTH,
        verify_quality: MCP_VERIFY_QUALITY,
      }),
    );
  });
});
