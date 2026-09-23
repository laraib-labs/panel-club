import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LibraryRecord } from "./library.ts";
import { groupLibrary, isLibraryEmpty } from "./library-view.ts";

function record(overrides: Partial<LibraryRecord> & { episodeId: string }): LibraryRecord {
  return {
    episodeId: overrides.episodeId,
    positionSeconds: overrides.positionSeconds ?? 0,
    finished: overrides.finished ?? false,
    saved: overrides.saved ?? false,
    lastWatchedAt: overrides.lastWatchedAt ?? null,
  };
}

describe("groupLibrary", () => {
  it("puts started unfinished episodes in continue", () => {
    const result = groupLibrary([record({ episodeId: "a", positionSeconds: 720 })]);

    assert.equal(result.continue.length, 1);
    assert.equal(result.continue[0].episodeId, "a");
    assert.equal(result.history.length, 0);
    assert.equal(result.saved.length, 0);
  });

  it("puts finished episodes in history, not continue", () => {
    const result = groupLibrary([
      record({ episodeId: "a", positionSeconds: 1000, finished: true }),
    ]);

    assert.equal(result.continue.length, 0);
    assert.equal(result.history.length, 1);
    assert.equal(result.history[0].episodeId, "a");
  });

  it("puts saved episodes in saved, including finished ones", () => {
    const result = groupLibrary([
      record({ episodeId: "saved-only", saved: true }),
      record({ episodeId: "both", positionSeconds: 500, finished: true, saved: true }),
    ]);

    assert.equal(result.saved.length, 2);
    assert.deepEqual(
      result.saved.map((item) => item.episodeId).sort(),
      ["both", "saved-only"],
    );
    assert.equal(result.history.length, 1);
    assert.equal(result.history[0].episodeId, "both");
    assert.equal(result.continue.length, 0);
  });

  it("excludes unwatched unsaved episodes from every bucket", () => {
    const result = groupLibrary([record({ episodeId: "ghost" })]);

    assert.equal(result.continue.length, 0);
    assert.equal(result.history.length, 0);
    assert.equal(result.saved.length, 0);
  });

  it("keeps continue and history mutually exclusive", () => {
    const result = groupLibrary([
      record({ episodeId: "c", positionSeconds: 100 }),
      record({ episodeId: "h", positionSeconds: 1000, finished: true }),
      record({ episodeId: "both", positionSeconds: 500, finished: true, saved: true }),
    ]);

    const continueIds = new Set(result.continue.map((item) => item.episodeId));
    const historyIds = new Set(result.history.map((item) => item.episodeId));

    for (const id of continueIds) {
      assert.ok(!historyIds.has(id));
    }
  });

  it("sorts continue and history by most recent watch first", () => {
    const result = groupLibrary([
      record({
        episodeId: "older",
        positionSeconds: 100,
        lastWatchedAt: "2026-01-01T00:00:00.000Z",
      }),
      record({
        episodeId: "newer",
        positionSeconds: 200,
        lastWatchedAt: "2026-02-01T00:00:00.000Z",
      }),
      record({
        episodeId: "finished-old",
        positionSeconds: 900,
        finished: true,
        lastWatchedAt: "2026-01-15T00:00:00.000Z",
      }),
      record({
        episodeId: "finished-new",
        positionSeconds: 1200,
        finished: true,
        lastWatchedAt: "2026-03-01T00:00:00.000Z",
      }),
    ]);

    assert.deepEqual(
      result.continue.map((item) => item.episodeId),
      ["newer", "older"],
    );
    assert.deepEqual(
      result.history.map((item) => item.episodeId),
      ["finished-new", "finished-old"],
    );
  });
});

describe("isLibraryEmpty", () => {
  it("is true only when continue, history, and saved are all empty", () => {
    assert.equal(isLibraryEmpty(groupLibrary([])), true);
  });

  it("is false when any bucket has items", () => {
    const onlyHistory = groupLibrary([
      record({ episodeId: "h", positionSeconds: 100, finished: true }),
    ]);
    assert.equal(isLibraryEmpty(onlyHistory), false);

    const withContinue = groupLibrary([record({ episodeId: "c", positionSeconds: 1 })]);
    assert.equal(isLibraryEmpty(withContinue), false);

    const withSaved = groupLibrary([record({ episodeId: "s", saved: true })]);
    assert.equal(isLibraryEmpty(withSaved), false);
  });
});
