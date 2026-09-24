import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type pg from "pg";

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

type PgReviewRow = {
  id: string;
  episode_id: string;
  viewer_id: string;
  parent_id: string | null;
  display_name: string;
  stars: number | null;
  body: string;
  spoiler: boolean;
  created_at: string;
};

export function initReviewsSchema(db: DatabaseSync): void {
  db.exec(REVIEWS_SCHEMA);
}

export function ensureReviewsSchema(db: DatabaseSync): void {
  db.exec(REVIEWS_TABLE);
}

function episodeExists(catalog: Catalog, episodeId: string): boolean {
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

function sanitizeDisplayName(displayName: string): string {
  const sanitized = stripTags(displayName).trim();

  if (sanitized.length === 0) {
    throw new Error("Display name is required");
  }

  if (sanitized.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`);
  }

  return sanitized;
}

function sanitizeBody(body: string): string {
  const sanitized = stripTags(body).trim();

  if (sanitized.length === 0) {
    throw new Error("Body is required");
  }

  if (sanitized.length > BODY_MAX_LENGTH) {
    throw new Error(`Body must be at most ${BODY_MAX_LENGTH} characters`);
  }

  return sanitized;
}

function assertValidStars(stars: number): void {
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

function pgRowToReview(row: PgReviewRow): Review {
  return {
    id: row.id,
    episodeId: row.episode_id,
    viewerId: row.viewer_id,
    parentId: row.parent_id,
    displayName: row.display_name,
    stars: row.stars,
    body: row.body,
    spoiler: row.spoiler,
    createdAt: row.created_at,
  };
}

const REVIEW_COLUMNS = `
  id,
  episode_id,
  viewer_id,
  parent_id,
  display_name,
  stars,
  body,
  spoiler,
  created_at
`;

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
  if (!episodeExists(catalog, input.episodeId)) {
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

async function findRootReviewIdPg(
  pool: pg.Pool,
  episodeId: string,
  viewerId: string,
): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `
    SELECT id
    FROM reviews
    WHERE episode_id = $1
      AND viewer_id = $2
      AND parent_id IS NULL
  `,
    [episodeId, viewerId],
  );

  return result.rows[0]?.id ?? null;
}

async function getReviewByIdPg(pool: pg.Pool, id: string): Promise<Review | null> {
  const result = await pool.query<PgReviewRow>(
    `
    SELECT ${REVIEW_COLUMNS}
    FROM reviews
    WHERE id = $1
  `,
    [id],
  );

  const row = result.rows[0];
  return row ? pgRowToReview(row) : null;
}

async function countViewerRepliesOnEpisodePg(
  pool: pg.Pool,
  episodeId: string,
  viewerId: string,
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM reviews
    WHERE episode_id = $1
      AND viewer_id = $2
      AND parent_id IS NOT NULL
  `,
    [episodeId, viewerId],
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function saveReviewPg(
  pool: pg.Pool,
  catalog: Catalog,
  input: SaveReviewInput,
): Promise<void> {
  if (!episodeExists(catalog, input.episodeId)) {
    throw new Error(`Unknown episode: ${input.episodeId}`);
  }

  assertValidStars(input.stars);

  const displayName = sanitizeDisplayName(input.displayName);
  const body = sanitizeBody(input.body);
  const createdAt = new Date().toISOString();
  const existingId = await findRootReviewIdPg(pool, input.episodeId, input.viewerId);

  if (existingId) {
    await pool.query(
      `
      UPDATE reviews
      SET
        display_name = $1,
        stars = $2,
        body = $3,
        spoiler = $4,
        created_at = $5
      WHERE id = $6
    `,
      [displayName, input.stars, body, input.spoiler, createdAt, existingId],
    );
    return;
  }

  await pool.query(
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
    ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8)
  `,
    [
      randomUUID(),
      input.episodeId,
      input.viewerId,
      displayName,
      input.stars,
      body,
      input.spoiler,
      createdAt,
    ],
  );
}

export async function saveReplyPg(pool: pg.Pool, input: SaveReplyInput): Promise<Review> {
  const parent = await getReviewByIdPg(pool, input.parentId);

  if (!parent) {
    throw new Error(`Unknown parent review: ${input.parentId}`);
  }

  if (parent.parentId !== null) {
    throw new Error("Replies cannot be nested more than one level");
  }

  if (
    (await countViewerRepliesOnEpisodePg(pool, parent.episodeId, input.viewerId)) >=
    MAX_REPLIES_PER_EPISODE_PER_VIEWER
  ) {
    throw new Error(
      `Viewer may post at most ${MAX_REPLIES_PER_EPISODE_PER_VIEWER} replies per episode`,
    );
  }

  const displayName = sanitizeDisplayName(input.displayName);
  const body = sanitizeBody(input.body);
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  await pool.query(
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
    ) VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8)
  `,
    [
      id,
      parent.episodeId,
      input.viewerId,
      parent.id,
      displayName,
      body,
      input.spoiler,
      createdAt,
    ],
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

export async function listReviewsPg(pool: pg.Pool, episodeId: string): Promise<Review[]> {
  const result = await pool.query<PgReviewRow>(
    `
    SELECT ${REVIEW_COLUMNS}
    FROM reviews
    WHERE episode_id = $1
      AND parent_id IS NULL
    ORDER BY created_at DESC
  `,
    [episodeId],
  );

  return result.rows.map(pgRowToReview);
}

export async function listReviewThreadPg(pool: pg.Pool, episodeId: string): Promise<ReviewThread[]> {
  const roots = await listReviewsPg(pool, episodeId);
  const threads: ReviewThread[] = [];

  for (const review of roots) {
    const result = await pool.query<PgReviewRow>(
      `
      SELECT ${REVIEW_COLUMNS}
      FROM reviews
      WHERE parent_id = $1
      ORDER BY created_at ASC
    `,
      [review.id],
    );

    threads.push({
      review,
      replies: result.rows.map(pgRowToReview),
    });
  }

  return threads;
}

export async function averageScorePg(pool: pg.Pool, episodeId: string): Promise<number | null> {
  const result = await pool.query<{ average: string | null }>(
    `
    SELECT AVG(stars)::text AS average
    FROM reviews
    WHERE episode_id = $1
      AND parent_id IS NULL
  `,
    [episodeId],
  );

  const average = result.rows[0]?.average;
  if (average === null || average === undefined) {
    return null;
  }

  return Number(average);
}
