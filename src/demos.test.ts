import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEMO_CONTRACTS,
  formatDemoCard,
  formatDemoIndex,
  getDemo,
} from "./demos.js";

describe("demo run contracts", () => {
  it("includes minesweeper and mona-lisa", () => {
    assert.ok(getDemo("minesweeper"));
    assert.ok(getDemo("mona-lisa"));
    assert.equal(DEMO_CONTRACTS.length >= 4, true);
  });

  it("formatDemoCard includes install and command", () => {
    const card = formatDemoCard(getDemo("minesweeper")!);
    assert.match(card, /glasswarp-demo minesweeper/);
    assert.match(card, /pip install "glasswarp\[demos\]"/);
    assert.match(card, /through the Glasswarp API/);
  });

  it("formatDemoIndex lists ids", () => {
    const index = formatDemoIndex();
    assert.match(index, /minesweeper/);
    assert.match(index, /mona-lisa/);
    assert.match(index, /ways-to-run-agents/);
  });
});
