import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import type { Catalog } from "./catalog.ts";
import {
  getReviewsPool,
  openReviewsDb,
  reviewsDbPath,
  reviewsUsesPostgres,
} from "./reviews-db.ts";
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
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalMountPath === undefined) {
      delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
    } else {
      process.env.RAILWAY_VOLUME_MOUNT_PATH = originalMountPath;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
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

  it("reviewsUsesPostgres is false without DATABASE_URL", () => {
    delete process.env.DATABASE_URL;

    assert.equal(reviewsUsesPostgres(), false);
  });

  it("reviewsUsesPostgres is true when DATABASE_URL is set", () => {
    process.env.DATABASE_URL = "postgres://example";

    assert.equal(reviewsUsesPostgres(), true);
  });

  it("getReviewsPool requires DATABASE_URL", () => {
    delete process.env.DATABASE_URL;

    assert.throws(() => getReviewsPool(), /DATABASE_URL is required/i);
  });

  it("openReviewsDb still uses sqlite when DATABASE_URL is set", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "panel-club-reviews-db-pg-"));
    process.env.RAILWAY_VOLUME_MOUNT_PATH = tempDir;
    process.env.DATABASE_URL = "postgres://example";

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
    db.close();

    rmSync(tempDir, { recursive: true, force: true });
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
    db.close();

    const again = openReviewsDb();
    assert.equal(listReviews(again, "ep-one").length, 1);
    again.close();

    rmSync(tempDir, { recursive: true, force: true });
  });
});
