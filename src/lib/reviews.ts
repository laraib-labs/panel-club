import { DatabaseSync } from "node:sqlite";

import type { Catalog } from "./catalog.ts";
import { getEpisode } from "./catalog.ts";

export type Review = {
  episodeId: string;
  viewerId: string;
  displayName: string;
  stars: number;
  body: string;
  spoiler: boolean;
  createdAt: string;
};

export type SaveReviewInput = {
  episodeId: string;
  viewerId: string;
  displayName: string;
  stars: number;
  body: string;
  spoiler: boolean;
};

const REVIEWS_SCHEMA = `
CREATE TABLE IF NOT EXISTS reviews (
  episode_id TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  stars INTEGER NOT NULL,
  body TEXT NOT NULL,
  spoiler INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (episode_id, viewer_id)
);
`;

export function initReviewsSchema(db: DatabaseSync): void {
  db.exec(REVIEWS_SCHEMA);
}

function episodeExists(catalog: Catalog, episodeId: string): boolean {
  for (const show of catalog.shows) {
    if (getEpisode(show, episodeId)) {
      return true;
    }
  }

  return false;
}

function assertValidStars(stars: number): void {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error("Stars must be an integer from 1 to 5");
  }
}

export function saveReview(db: DatabaseSync, catalog: Catalog, input: SaveReviewInput): void {
  if (!episodeExists(catalog, input.episodeId)) {
    throw new Error(`Unknown episode: ${input.episodeId}`);
  }

  assertValidStars(input.stars);

  const statement = db.prepare(`
    INSERT INTO reviews (
      episode_id,
      viewer_id,
      display_name,
      stars,
      body,
      spoiler,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (episode_id, viewer_id) DO UPDATE SET
      display_name = excluded.display_name,
      stars = excluded.stars,
      body = excluded.body,
      spoiler = excluded.spoiler,
      created_at = excluded.created_at
  `);

  statement.run(
    input.episodeId,
    input.viewerId,
    input.displayName,
    input.stars,
    input.body,
    input.spoiler ? 1 : 0,
    new Date().toISOString(),
  );
}

export function listReviews(db: DatabaseSync, episodeId: string): Review[] {
  const rows = db
    .prepare(
      `
      SELECT
        episode_id,
        viewer_id,
        display_name,
        stars,
        body,
        spoiler,
        created_at
      FROM reviews
      WHERE episode_id = ?
      ORDER BY created_at DESC
    `,
    )
    .all(episodeId) as Array<{
    episode_id: string;
    viewer_id: string;
    display_name: string;
    stars: number;
    body: string;
    spoiler: number;
    created_at: string;
  }>;

  return rows.map((row) => ({
    episodeId: row.episode_id,
    viewerId: row.viewer_id,
    displayName: row.display_name,
    stars: row.stars,
    body: row.body,
    spoiler: row.spoiler === 1,
    createdAt: row.created_at,
  }));
}

export function averageScore(db: DatabaseSync, episodeId: string): number | null {
  const row = db
    .prepare(
      `
      SELECT AVG(stars) AS average
      FROM reviews
      WHERE episode_id = ?
    `,
    )
    .get(episodeId) as { average: number | null };

  if (row.average === null) {
    return null;
  }

  return row.average;
}
