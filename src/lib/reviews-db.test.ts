import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import type { Catalog } from "./catalog.ts";
import { openReviewsDb, reviewsDbPath } from "./reviews-db.ts";
import { listReviews, saveReview } from "./reviews.ts";

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
      ],
    },
  ],
};

describe("reviews-db", () => {
  const originalMountPath = process.env.RAILWAY_VOLUME_MOUNT_PATH;

  afterEach(() => {
    if (originalMountPath === undefined) {
      delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
    } else {
      process.env.RAILWAY_VOLUME_MOUNT_PATH = originalMountPath;
    }
  });

  it("reviewsDbPath defaults to data/panel-club.sqlite under cwd", () => {
    delete process.env.RAILWAY_VOLUME_MOUNT_PATH;

    assert.equal(reviewsDbPath(), join(process.cwd(), "data", "panel-club.sqlite"));
  });

  it("reviewsDbPath uses RAILWAY_VOLUME_MOUNT_PATH when set", () => {
    process.env.RAILWAY_VOLUME_MOUNT_PATH = "/data";

    assert.equal(reviewsDbPath(), "/data/panel-club.sqlite");
  });

  it("openReviewsDb creates the database and initializes schema", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "panel-club-reviews-db-"));
    process.env.RAILWAY_VOLUME_MOUNT_PATH = tempDir;

    const db = openReviewsDb();

    saveReview(db, fixtureCatalog, {
      episodeId: "ep-one",
      viewerId: "viewer-1",
      displayName: "Alice",
      stars: 4,
      body: "Fun episode",
      spoiler: false,
    });

    assert.equal(listReviews(db, "ep-one").length, 1);

    rmSync(tempDir, { recursive: true, force: true });
  });
});
