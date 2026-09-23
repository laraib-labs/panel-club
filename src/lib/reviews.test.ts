import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import type { Catalog } from "./catalog.ts";
import { averageScore, initReviewsSchema, listReviews, saveReview } from "./reviews.ts";

const fixtureCatalog: Catalog = {
  shows: [
    {
      name: "Test Show",
      host: "Host One",
      category: "Panel shows",
      description: "",
      coverVideoId: "cover1",
      sourceUrl: "https://example.com",
      checkedAt: "2026-01-01",
      availabilityNote: "",
      episodes: [
        {
          title: "Episode One",
          videoId: "ep-one",
          guest: "Guest A",
          duration: 100,
          status: "aired",
          mediaUrl: null,
        },
        {
          title: "Episode Two",
          videoId: "ep-two",
          guest: "",
          duration: 200,
          status: "aired",
          mediaUrl: null,
        },
      ],
    },
  ],
};

function makeDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  initReviewsSchema(db);
  return db;
}

describe("reviews", () => {
  it("saveReview stores a review for a known episode", () => {
    const db = makeDb();

    saveReview(db, fixtureCatalog, {
      episodeId: "ep-one",
      viewerId: "viewer-1",
      displayName: "Alice",
      stars: 4,
      body: "Fun episode",
      spoiler: false,
    });

    const reviews = listReviews(db, "ep-one");
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0]?.viewerId, "viewer-1");
    assert.equal(reviews[0]?.displayName, "Alice");
    assert.equal(reviews[0]?.stars, 4);
    assert.equal(reviews[0]?.body, "Fun episode");
    assert.equal(reviews[0]?.spoiler, false);
  });

  it("saveReview rejects unknown episode ids", () => {
    const db = makeDb();

    assert.throws(
      () =>
        saveReview(db, fixtureCatalog, {
          episodeId: "missing-ep",
          viewerId: "viewer-1",
          displayName: "Alice",
          stars: 4,
          body: "Nope",
          spoiler: false,
        }),
      /unknown episode/i,
    );
  });

  it("saveReview rejects stars outside 1-5", () => {
    const db = makeDb();

    for (const stars of [0, 6, 3.5, Number.NaN]) {
      assert.throws(
        () =>
          saveReview(db, fixtureCatalog, {
            episodeId: "ep-one",
            viewerId: "viewer-1",
            displayName: "Alice",
            stars,
            body: "Bad stars",
            spoiler: false,
          }),
        /stars/i,
      );
    }
  });

  it("saveReview replaces the same viewer's earlier review", () => {
    const db = makeDb();

    saveReview(db, fixtureCatalog, {
      episodeId: "ep-one",
      viewerId: "viewer-1",
      displayName: "Alice",
      stars: 3,
      body: "First take",
      spoiler: false,
    });

    saveReview(db, fixtureCatalog, {
      episodeId: "ep-one",
      viewerId: "viewer-1",
      displayName: "Alice",
      stars: 5,
      body: "Changed my mind",
      spoiler: true,
    });

    const reviews = listReviews(db, "ep-one");
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0]?.stars, 5);
    assert.equal(reviews[0]?.body, "Changed my mind");
    assert.equal(reviews[0]?.spoiler, true);
  });

  it("allows different viewers to review the same episode", () => {
    const db = makeDb();

    saveReview(db, fixtureCatalog, {
      episodeId: "ep-one",
      viewerId: "viewer-1",
      displayName: "Alice",
      stars: 4,
      body: "Good",
      spoiler: false,
    });

    saveReview(db, fixtureCatalog, {
      episodeId: "ep-one",
      viewerId: "viewer-2",
      displayName: "Bob",
      stars: 2,
      body: "Meh",
      spoiler: true,
    });

    const reviews = listReviews(db, "ep-one");
    assert.equal(reviews.length, 2);
    assert.deepEqual(
      reviews.map((review) => review.viewerId).sort(),
      ["viewer-1", "viewer-2"],
    );
  });

  it("averageScore returns null when there are no reviews", () => {
    const db = makeDb();

    assert.equal(averageScore(db, "ep-one"), null);
  });

  it("averageScore returns the mean stars for an episode", () => {
    const db = makeDb();

    saveReview(db, fixtureCatalog, {
      episodeId: "ep-two",
      viewerId: "viewer-1",
      displayName: "Alice",
      stars: 4,
      body: "A",
      spoiler: false,
    });

    saveReview(db, fixtureCatalog, {
      episodeId: "ep-two",
      viewerId: "viewer-2",
      displayName: "Bob",
      stars: 5,
      body: "B",
      spoiler: false,
    });

    assert.equal(averageScore(db, "ep-two"), 4.5);
  });
});
