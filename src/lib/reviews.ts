import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { Catalog } from "./catalog.ts";
import { getEpisode } from "./catalog.ts";

export const MAX_REPLIES_PER_EPISODE_PER_VIEWER = 3;
export const DISPLAY_NAME_MAX_LENGTH = 40;
export const BODY_MAX_LENGTH = 500;

export type Review = {
  id: string;
  episodeId: string;
  viewerId: string;
  parentId: string | null;
  displayName: string;
  stars: number | null;
  body: string;
  spoiler: boolean;
  createdAt: string;
};

export type ReviewThread = {
  review: Review;
  replies: Review[];
};

export type SaveReviewInput = {
  episodeId: string;
  viewerId: string;
  displayName: string;
  stars: number;
  body: string;
  spoiler: boolean;
};

export type SaveReplyInput = {
  parentId: string;
  viewerId: string;
  displayName: string;
  body: string;
  spoiler: boolean;
};

const REVIEWS_TABLE = `
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  parent_id TEXT,
  display_name TEXT NOT NULL,
  stars INTEGER,
  body TEXT NOT NULL,
  spoiler INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_root_unique
  ON reviews (episode_id, viewer_id)
  WHERE parent_id IS NULL;
`;

const REVIEWS_SCHEMA = `
DROP TABLE IF EXISTS reviews;
${REVIEWS_TABLE}
`;

type ReviewRow = {
  id: string;
  episode_id: string;
  viewer_id: string;
  parent_id: string | null;
  display_name: string;
  stars: number | null;
  body: string;
  spoiler: number;
  created_at: string;
};

export function initReviewsSchema(db: DatabaseSync): void {
  db.exec(REVIEWS_SCHEMA);
}

export function ensureReviewsSchema(db: DatabaseSync): void {
  db.exec(REVIEWS_TABLE);
}

export function reviewEpisodeExists(catalog: Catalog, episodeId: string): boolean {
  for (const show of catalog.shows) {
    if (getEpisode(show, episodeId)) {
      return true;
    }
  }

  return false;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

export function sanitizeDisplayName(displayName: string): string {
  const sanitized = stripTags(displayName).trim();

  if (sanitized.length === 0) {
    throw new Error("Display name is required");
  }

  if (sanitized.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`);
  }

  return sanitized;
}

export function sanitizeBody(body: string): string {
  const sanitized = stripTags(body).trim();

  if (sanitized.length === 0) {
    throw new Error("Body is required");
  }

  if (sanitized.length > BODY_MAX_LENGTH) {
    throw new Error(`Body must be at most ${BODY_MAX_LENGTH} characters`);
  }

  return sanitized;
}

export function assertValidStars(stars: number): void {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error("Stars must be an integer from 1 to 5");
  }
}

function rowToReview(row: ReviewRow): Review {
  return {
    id: row.id,
    episodeId: row.episode_id,
    viewerId: row.viewer_id,
    parentId: row.parent_id,
    displayName: row.display_name,
    stars: row.stars,
    body: row.body,
    spoiler: row.spoiler === 1,
    createdAt: row.created_at,
  };
}

function findRootReviewId(
  db: DatabaseSync,
  episodeId: string,
  viewerId: string,
): string | null {
  const row = db
    .prepare(
      `
      SELECT id
      FROM reviews
      WHERE episode_id = ?
        AND viewer_id = ?
        AND parent_id IS NULL
    `,
    )
    .get(episodeId, viewerId) as { id: string } | undefined;

  return row?.id ?? null;
}

function getReviewById(db: DatabaseSync, id: string): Review | null {
  const row = db
    .prepare(
      `
      SELECT
        id,
        episode_id,
        viewer_id,
        parent_id,
        display_name,
        stars,
        body,
        spoiler,
        created_at
      FROM reviews
      WHERE id = ?
    `,
    )
    .get(id) as ReviewRow | undefined;

  return row ? rowToReview(row) : null;
}

function countViewerRepliesOnEpisode(
  db: DatabaseSync,
  episodeId: string,
  viewerId: string,
): number {
  const row = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM reviews
      WHERE episode_id = ?
        AND viewer_id = ?
        AND parent_id IS NOT NULL
    `,
    )
    .get(episodeId, viewerId) as { count: number };

  return row.count;
}

export function saveReview(db: DatabaseSync, catalog: Catalog, input: SaveReviewInput): void {
  if (!reviewEpisodeExists(catalog, input.episodeId)) {
    throw new Error(`Unknown episode: ${input.episodeId}`);
  }

  assertValidStars(input.stars);

  const displayName = sanitizeDisplayName(input.displayName);
  const body = sanitizeBody(input.body);
  const createdAt = new Date().toISOString();
  const existingId = findRootReviewId(db, input.episodeId, input.viewerId);

  if (existingId) {
    db.prepare(
      `
      UPDATE reviews
      SET
        display_name = ?,
        stars = ?,
        body = ?,
        spoiler = ?,
        created_at = ?
      WHERE id = ?
    `,
    ).run(displayName, input.stars, body, input.spoiler ? 1 : 0, createdAt, existingId);
    return;
  }

  db.prepare(
    `
    INSERT INTO reviews (
      id,
      episode_id,
      viewer_id,
      parent_id,
      display_name,
      stars,
      body,
      spoiler,
      created_at
    ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)
  `,
  ).run(
    randomUUID(),
    input.episodeId,
    input.viewerId,
    displayName,
    input.stars,
    body,
    input.spoiler ? 1 : 0,
    createdAt,
  );
}

export function saveReply(db: DatabaseSync, input: SaveReplyInput): Review {
  const parent = getReviewById(db, input.parentId);

  if (!parent) {
    throw new Error(`Unknown parent review: ${input.parentId}`);
  }

  if (parent.parentId !== null) {
    throw new Error("Replies cannot be nested more than one level");
  }

  if (countViewerRepliesOnEpisode(db, parent.episodeId, input.viewerId) >= MAX_REPLIES_PER_EPISODE_PER_VIEWER) {
    throw new Error(
      `Viewer may post at most ${MAX_REPLIES_PER_EPISODE_PER_VIEWER} replies per episode`,
    );
  }

  const displayName = sanitizeDisplayName(input.displayName);
  const body = sanitizeBody(input.body);
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO reviews (
      id,
      episode_id,
      viewer_id,
      parent_id,
      display_name,
      stars,
      body,
      spoiler,
      created_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
  `,
  ).run(
    id,
    parent.episodeId,
    input.viewerId,
    parent.id,
    displayName,
    body,
    input.spoiler ? 1 : 0,
    createdAt,
  );

  return {
    id,
    episodeId: parent.episodeId,
    viewerId: input.viewerId,
    parentId: parent.id,
    displayName,
    stars: null,
    body,
    spoiler: input.spoiler,
    createdAt,
  };
}

export function listReviews(db: DatabaseSync, episodeId: string): Review[] {
  const rows = db
    .prepare(
      `
      SELECT
        id,
        episode_id,
        viewer_id,
        parent_id,
        display_name,
        stars,
        body,
        spoiler,
        created_at
      FROM reviews
      WHERE episode_id = ?
        AND parent_id IS NULL
      ORDER BY created_at DESC
    `,
    )
    .all(episodeId) as ReviewRow[];

  return rows.map(rowToReview);
}

export function listReviewThread(db: DatabaseSync, episodeId: string): ReviewThread[] {
  const roots = listReviews(db, episodeId);
  const replyStatement = db.prepare(
    `
    SELECT
      id,
      episode_id,
      viewer_id,
      parent_id,
      display_name,
      stars,
      body,
      spoiler,
      created_at
    FROM reviews
    WHERE parent_id = ?
    ORDER BY created_at ASC
  `,
  );

  return roots.map((review) => ({
    review,
    replies: (replyStatement.all(review.id) as ReviewRow[]).map(rowToReview),
  }));
}

export function averageScore(db: DatabaseSync, episodeId: string): number | null {
  const row = db
    .prepare(
      `
      SELECT AVG(stars) AS average
      FROM reviews
      WHERE episode_id = ?
        AND parent_id IS NULL
    `,
    )
    .get(episodeId) as { average: number | null };

  if (row.average === null) {
    return null;
  }

  return row.average;
}
