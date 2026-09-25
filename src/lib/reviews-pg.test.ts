import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { combineEpisodeScores, emptyEpisodeScore } from "./reviews-pg.ts";

describe("combineEpisodeScores", () => {
  it("returns empty when nothing is scored", () => {
    assert.deepEqual(combineEpisodeScores([]), emptyEpisodeScore());
    assert.deepEqual(combineEpisodeScores([emptyEpisodeScore()]), emptyEpisodeScore());
  });

  it("weights by review count", () => {
    const combined = combineEpisodeScores([
      { average: 5, reviewCount: 1 },
      { average: 3, reviewCount: 3 },
    ]);

    assert.equal(combined.reviewCount, 4);
    assert.equal(combined.average, 3.5);
  });
});
