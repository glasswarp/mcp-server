import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { allowsUnauthenticatedDiscovery } from "./discovery.js";

const init = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "probe", version: "0" },
  },
};

describe("allowsUnauthenticatedDiscovery", () => {
  it("allows initialize and tools/list", () => {
    assert.equal(allowsUnauthenticatedDiscovery(init), true);
    assert.equal(
      allowsUnauthenticatedDiscovery({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
      true,
    );
  });

  it("rejects tools/call and unknown methods", () => {
    assert.equal(
      allowsUnauthenticatedDiscovery({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "rigs.list", arguments: {} },
      }),
      false,
    );
    assert.equal(
      allowsUnauthenticatedDiscovery({
        jsonrpc: "2.0",
        id: 4,
        method: "session/create",
      }),
      false,
    );
  });

  it("rejects batches that mix discovery with tools/call", () => {
    assert.equal(
      allowsUnauthenticatedDiscovery([
        init,
        {
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "rigs.list", arguments: {} },
        },
      ]),
      false,
    );
  });

  it("rejects empty or non-RPC bodies", () => {
    assert.equal(allowsUnauthenticatedDiscovery(undefined), false);
    assert.equal(allowsUnauthenticatedDiscovery({}), false);
    assert.equal(allowsUnauthenticatedDiscovery([]), false);
  });
});
