import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type pg from "pg";

import { createCatalogPool } from "../platform/pg.ts";
import { ensureReviewsSchema } from "./reviews.ts";

let reviewsPool: pg.Pool | null = null;

export function reviewsDbPath(): string {
  const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? join(process.cwd(), "data");
  return join(dataDir, "panel-club.sqlite");
}

/** True when Neon/Postgres reviews are configured. Pages still use sqlite until the Live read slice. */
export function reviewsUsesPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getReviewsPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Postgres reviews");
  }

  if (!reviewsPool) {
    reviewsPool = createCatalogPool(connectionString);
  }

  return reviewsPool;
}

export async function closeReviewsPool(): Promise<void> {
  if (reviewsPool) {
    await reviewsPool.end();
    reviewsPool = null;
  }
}

/** Local sqlite reviews store. Used by pages and unit tests regardless of DATABASE_URL. */
export function openReviewsDb(): DatabaseSync {
  const dbPath = reviewsDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  ensureReviewsSchema(db);
  return db;
}
