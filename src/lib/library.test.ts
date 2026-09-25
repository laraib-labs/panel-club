import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getLibraryRecord,
  listLibrary,
  markFinished,
  recordWatch,
  toggleSave,
} from "./library.ts";

function makeStorage(): Map<string, string> {
  return new Map();
}

describe("library", () => {
  it("recordWatch stores position and marks not finished", () => {
    const storage = makeStorage();
    recordWatch(storage, "ep-1", 720);

    const items = listLibrary(storage);
    assert.equal(items.length, 1);
    assert.equal(items[0].episodeId, "ep-1");
    assert.equal(items[0].positionSeconds, 720);
    assert.equal(items[0].finished, false);
    assert.ok(items[0].lastWatchedAt);
  });

  it("markFinished marks episode complete", () => {
    const storage = makeStorage();
    recordWatch(storage, "ep-1", 720);
    markFinished(storage, "ep-1");

    const items = listLibrary(storage);
    assert.equal(items[0].finished, true);
    assert.equal(items[0].positionSeconds, 720);
  });

  it("getLibraryRecord returns the stored episode", () => {
    const storage = makeStorage();
    recordWatch(storage, "ep-9", 12);

    const record = getLibraryRecord(storage, "ep-9");
    assert.equal(record?.positionSeconds, 12);
    assert.equal(getLibraryRecord(storage, "missing"), undefined);
  });

  it("toggleSave adds and removes saved flag", () => {
    const storage = makeStorage();

    assert.equal(toggleSave(storage, "ep-2"), true);
    assert.equal(toggleSave(storage, "ep-2"), false);

    const items = listLibrary(storage);
    assert.equal(items.length, 1);
    assert.equal(items[0].episodeId, "ep-2");
    assert.equal(items[0].saved, false);
  });

  it("listLibrary returns fields needed for grouping", () => {
    const storage = makeStorage();
    recordWatch(storage, "continue-ep", 300);
    recordWatch(storage, "history-ep", 1000);
    markFinished(storage, "history-ep");
    toggleSave(storage, "saved-ep");

    const items = listLibrary(storage);
    const byId = new Map(items.map((item) => [item.episodeId, item]));

    const continueItem = byId.get("continue-ep");
    assert.ok(continueItem);
    assert.equal(continueItem.finished, false);
    assert.equal(continueItem.positionSeconds, 300);
    assert.ok(continueItem.lastWatchedAt);

    const historyItem = byId.get("history-ep");
    assert.ok(historyItem);
    assert.equal(historyItem.finished, true);

    const savedItem = byId.get("saved-ep");
    assert.ok(savedItem);
    assert.equal(savedItem.saved, true);
    assert.equal(savedItem.positionSeconds, 0);
    assert.equal(savedItem.finished, false);
  });

  it("updates position on repeat recordWatch", () => {
    const storage = makeStorage();
    recordWatch(storage, "ep-1", 100);
    recordWatch(storage, "ep-1", 500);

    const items = listLibrary(storage);
    assert.equal(items[0].positionSeconds, 500);
  });

  it("preserves saved when recording watch", () => {
    const storage = makeStorage();
    toggleSave(storage, "ep-1");
    recordWatch(storage, "ep-1", 200);

    const items = listLibrary(storage);
    assert.equal(items[0].saved, true);
    assert.equal(items[0].positionSeconds, 200);
    assert.equal(items[0].finished, false);
  });
});
