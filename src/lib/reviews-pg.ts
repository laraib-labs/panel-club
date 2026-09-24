import { randomUUID } from "node:crypto";
import type pg from "pg";

import type { Catalog } from "./catalog.ts";
import {
  MAX_REPLIES_PER_EPISODE_PER_VIEWER,
  assertValidStars,
  reviewEpisodeExists,
  sanitizeBody,
  sanitizeDisplayName,
  type Review,
  type ReviewThread,
  type SaveReplyInput,
  type SaveReviewInput,
} from "./reviews.ts";

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

async function findRootReviewId(
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

async function getReviewById(pool: pg.Pool, id: string): Promise<Review | null> {
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

async function countViewerRepliesOnEpisode(
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

export async function saveReview(
  pool: pg.Pool,
  catalog: Catalog,
  input: SaveReviewInput,
): Promise<void> {
  if (!reviewEpisodeExists(catalog, input.episodeId)) {
    throw new Error(`Unknown episode: ${input.episodeId}`);
  }

  assertValidStars(input.stars);

  const displayName = sanitizeDisplayName(input.displayName);
  const body = sanitizeBody(input.body);
  const createdAt = new Date().toISOString();
  const existingId = await findRootReviewId(pool, input.episodeId, input.viewerId);

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

export async function saveReply(pool: pg.Pool, input: SaveReplyInput): Promise<Review> {
  const parent = await getReviewById(pool, input.parentId);

  if (!parent) {
    throw new Error(`Unknown parent review: ${input.parentId}`);
  }

  if (parent.parentId !== null) {
    throw new Error("Replies cannot be nested more than one level");
  }

  if (
    (await countViewerRepliesOnEpisode(pool, parent.episodeId, input.viewerId)) >=
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

export async function listReviews(pool: pg.Pool, episodeId: string): Promise<Review[]> {
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

export async function listReviewThread(pool: pg.Pool, episodeId: string): Promise<ReviewThread[]> {
  const roots = await listReviews(pool, episodeId);
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

export async function averageScore(pool: pg.Pool, episodeId: string): Promise<number | null> {
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
