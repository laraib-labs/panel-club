import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { initReviewsSchema } from "./reviews.ts";

export function reviewsDbPath(): string {
  const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? join(process.cwd(), "data");
  return join(dataDir, "panel-club.sqlite");
}

export function openReviewsDb(): DatabaseSync {
  const dbPath = reviewsDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  initReviewsSchema(db);
  return db;
}
