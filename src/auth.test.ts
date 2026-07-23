import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";

import { extractBearerApiKey, redactKey } from "./auth.js";
import { keysToEvents } from "./keys.js";

function fakeReq(authorization?: string): Request {
  return {
    header(name: string) {
      if (name.toLowerCase() === "authorization") return authorization;
      return undefined;
    },
  } as Request;
}

describe("extractBearerApiKey", () => {
  it("accepts gw_ keys", () => {
    assert.equal(
      extractBearerApiKey(fakeReq("Bearer gw_live_sk_abc123xyz")),
      "gw_live_sk_abc123xyz",
    );
  });

  it("rejects missing or non-gw keys", () => {
    assert.equal(extractBearerApiKey(fakeReq()), null);
    assert.equal(extractBearerApiKey(fakeReq("Bearer sk-openai")), null);
  });
});

describe("redactKey", () => {
  it("never returns the full key", () => {
    const key = "gw_live_sk_abcdefghijklmnop";
    const redacted = redactKey(key);
    assert.notEqual(redacted, key);
    assert.ok(redacted.includes("…"));
  });
});

describe("keysToEvents", () => {
  it("maps enter", () => {
    assert.deepEqual(keysToEvents("enter"), [{ type: "key_press", key: "Enter" }]);
  });

  it("maps ctrl+s", () => {
    const ev = keysToEvents("ctrl+s");
    assert.deepEqual(ev[0], { type: "key_down", key: "Control" });
    assert.deepEqual(ev[1], { type: "key_press", key: "s" });
    assert.deepEqual(ev[2], { type: "key_up", key: "Control" });
  });
});
