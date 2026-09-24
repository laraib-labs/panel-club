import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import type { Catalog } from "./catalog.ts";
import {
  BODY_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  MAX_REPLIES_PER_EPISODE_PER_VIEWER,
  averageScore,
  initReviewsSchema,
  listReviewThread,
  listReviews,
  saveReply,
  saveReview,
} from "./reviews.ts";

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

function saveRootReview(
  db: DatabaseSync,
  overrides: Partial<Parameters<typeof saveReview>[2]> & Pick<Parameters<typeof saveReview>[2], "viewerId">,
): string {
  saveReview(db, fixtureCatalog, {
    episodeId: "ep-one",
    displayName: "Alice",
    stars: 4,
    body: "Fun episode",
    spoiler: false,
    ...overrides,
  });

  const review = listReviews(db, overrides.episodeId ?? "ep-one").find(
    (row) => row.viewerId === overrides.viewerId,
  );
  assert.ok(review?.id);
  return review.id;
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
    assert.equal(reviews[0]?.parentId, null);
    assert.ok(reviews[0]?.id);
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

    const firstId = listReviews(db, "ep-one")[0]?.id;

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
    assert.equal(reviews[0]?.id, firstId);
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

  it("saveReview trims display name and body and strips tags", () => {
    const db = makeDb();

    saveReview(db, fixtureCatalog, {
      episodeId: "ep-one",
      viewerId: "viewer-1",
      displayName: "  <b>Alice</b>  ",
      stars: 4,
      body: "  <i>Nice</i> episode  ",
      spoiler: false,
    });

    const review = listReviews(db, "ep-one")[0];
    assert.equal(review?.displayName, "Alice");
    assert.equal(review?.body, "Nice episode");
  });

  it("saveReview rejects display names longer than 40 characters", () => {
    const db = makeDb();

    assert.throws(
      () =>
        saveReview(db, fixtureCatalog, {
          episodeId: "ep-one",
          viewerId: "viewer-1",
          displayName: "a".repeat(DISPLAY_NAME_MAX_LENGTH + 1),
          stars: 4,
          body: "Fine",
          spoiler: false,
        }),
      /display name/i,
    );
  });

  it("saveReview rejects bodies longer than 500 characters", () => {
    const db = makeDb();

    assert.throws(
      () =>
        saveReview(db, fixtureCatalog, {
          episodeId: "ep-one",
          viewerId: "viewer-1",
          displayName: "Alice",
          stars: 4,
          body: "a".repeat(BODY_MAX_LENGTH + 1),
          spoiler: false,
        }),
      /body/i,
    );
  });

  it("saveReply inserts a one-level reply with null stars", () => {
    const db = makeDb();
    const parentId = saveRootReview(db, { viewerId: "viewer-root" });

    const reply = saveReply(db, {
      parentId,
      viewerId: "viewer-reply",
      displayName: "Bob",
      body: "Agreed",
      spoiler: false,
    });

    assert.equal(reply.parentId, parentId);
    assert.equal(reply.stars, null);
    assert.equal(reply.body, "Agreed");
  });

  it("saveReply rejects missing parent ids", () => {
    const db = makeDb();

    assert.throws(
      () =>
        saveReply(db, {
          parentId: "missing-parent",
          viewerId: "viewer-reply",
          displayName: "Bob",
          body: "Nope",
          spoiler: false,
        }),
      /unknown parent/i,
    );
  });

  it("saveReply rejects replies to replies", () => {
    const db = makeDb();
    const parentId = saveRootReview(db, { viewerId: "viewer-root" });
    const reply = saveReply(db, {
      parentId,
      viewerId: "viewer-reply",
      displayName: "Bob",
      body: "First reply",
      spoiler: false,
    });

    assert.throws(
      () =>
        saveReply(db, {
          parentId: reply.id,
          viewerId: "viewer-nested",
          displayName: "Carol",
          body: "Too deep",
          spoiler: false,
        }),
      /one level/i,
    );
  });

  it("saveReply rejects more than three replies per viewer per episode", () => {
    const db = makeDb();
    const parentId = saveRootReview(db, { viewerId: "viewer-root" });

    for (let index = 0; index < MAX_REPLIES_PER_EPISODE_PER_VIEWER; index += 1) {
      saveReply(db, {
        parentId,
        viewerId: "viewer-reply",
        displayName: "Bob",
        body: `Reply ${index + 1}`,
        spoiler: false,
      });
    }

    assert.throws(
      () =>
        saveReply(db, {
          parentId,
          viewerId: "viewer-reply",
          displayName: "Bob",
          body: "One too many",
          spoiler: false,
        }),
      /at most 3 replies/i,
    );
  });

  it("listReviewThread returns roots with nested replies only one level deep", () => {
    const db = makeDb();
    const parentId = saveRootReview(db, { viewerId: "viewer-root", displayName: "Alice" });

    saveReply(db, {
      parentId,
      viewerId: "viewer-reply-1",
      displayName: "Bob",
      body: "Reply one",
      spoiler: false,
    });

    saveReply(db, {
      parentId,
      viewerId: "viewer-reply-2",
      displayName: "Carol",
      body: "Reply two",
      spoiler: true,
    });

    const thread = listReviewThread(db, "ep-one");
    assert.equal(thread.length, 1);
    assert.equal(thread[0]?.review.displayName, "Alice");
    assert.equal(thread[0]?.replies.length, 2);
    assert.deepEqual(
      thread[0]?.replies.map((reply) => reply.body),
      ["Reply one", "Reply two"],
    );
    assert.equal(thread[0]?.replies.every((reply) => reply.stars === null), true);
  });

  it("listReviews and averageScore ignore replies", () => {
    const db = makeDb();
    const parentId = saveRootReview(db, {
      viewerId: "viewer-root",
      stars: 4,
      body: "Root review",
    });

    saveReply(db, {
      parentId,
      viewerId: "viewer-reply",
      displayName: "Bob",
      body: "Reply only",
      spoiler: false,
    });

    assert.equal(listReviews(db, "ep-one").length, 1);
    assert.equal(averageScore(db, "ep-one"), 4);
  });
});
