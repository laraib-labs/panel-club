import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { castDecision } from "./cast.ts";

describe("castDecision", () => {
  it("returns prompt for a file episode when a cast device is available", () => {
    assert.equal(castDecision({ kind: "file", deviceAvailable: true }), "prompt");
  });

  it("returns hidden for a file episode when no cast device is available", () => {
    assert.equal(castDecision({ kind: "file", deviceAvailable: false }), "hidden");
  });

  it("returns hidden for YouTube episodes even when a cast device is available", () => {
    assert.equal(castDecision({ kind: "youtube", deviceAvailable: true }), "hidden");
  });

  it("returns hidden for YouTube episodes when no cast device is available", () => {
    assert.equal(castDecision({ kind: "youtube", deviceAvailable: false }), "hidden");
  });
});
