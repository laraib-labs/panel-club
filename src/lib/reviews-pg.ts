import { randomUUID } from "node:crypto";
import type pg from "pg";

import type { Catalog } from "./catalog.ts";
import {
  MAX_REPLIES_PER_EPISODE_PER_VIEWER,
  assertValidStars,
  reviewEpisodeExists,
  sanitizeBody,
  sanitizeOptionalBody,
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
    FROM panel_club.reviews
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
    FROM panel_club.reviews
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
    FROM panel_club.reviews
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
  const body = sanitizeOptionalBody(input.body);
  const createdAt = new Date().toISOString();
  const existingId = await findRootReviewId(pool, input.episodeId, input.viewerId);

  if (existingId) {
    await pool.query(
      `
      UPDATE panel_club.reviews
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
    INSERT INTO panel_club.reviews (
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
    INSERT INTO panel_club.reviews (
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

export type EpisodeScore = {
  average: number | null;
  reviewCount: number;
};

export function emptyEpisodeScore(): EpisodeScore {
  return { average: null, reviewCount: 0 };
}

export function combineEpisodeScores(scores: EpisodeScore[]): EpisodeScore {
  let weighted = 0;
  let reviewCount = 0;

  for (const score of scores) {
    if (score.average === null || score.reviewCount === 0) {
      continue;
    }

    weighted += score.average * score.reviewCount;
    reviewCount += score.reviewCount;
  }

  return reviewCount === 0
    ? emptyEpisodeScore()
    : { average: weighted / reviewCount, reviewCount };
}

export async function listEpisodeScores(pool: pg.Pool): Promise<Map<string, EpisodeScore>> {
  const result = await pool.query<{
    episode_id: string;
    average: string;
    review_count: string;
  }>(`
    SELECT
      episode_id,
      AVG(stars)::text AS average,
      COUNT(*)::text AS review_count
    FROM panel_club.reviews
    WHERE parent_id IS NULL
    GROUP BY episode_id
  `);

  const scores = new Map<string, EpisodeScore>();
  for (const row of result.rows) {
    scores.set(row.episode_id, {
      average: Number(row.average),
      reviewCount: Number(row.review_count),
    });
  }

  return scores;
}

export async function listReviews(pool: pg.Pool, episodeId: string): Promise<Review[]> {
  const result = await pool.query<PgReviewRow>(
    `
    SELECT ${REVIEW_COLUMNS}
    FROM panel_club.reviews
    WHERE episode_id = $1
      AND parent_id IS NULL
    ORDER BY created_at DESC
  `,
    [episodeId],
  );

  return result.rows.map(pgRowToReview);
}

export async function listReviewThread(pool: pg.Pool, episodeId: string): Promise<ReviewThread[]> {
  const result = await pool.query<PgReviewRow>(
    `
    SELECT ${REVIEW_COLUMNS}
    FROM panel_club.reviews
    WHERE episode_id = $1
    ORDER BY created_at ASC
  `,
    [episodeId],
  );

  const reviews = result.rows.map(pgRowToReview);
  const repliesByParent = new Map<string, Review[]>();

  for (const review of reviews) {
    if (review.parentId === null) {
      continue;
    }

    const replies = repliesByParent.get(review.parentId) ?? [];
    replies.push(review);
    repliesByParent.set(review.parentId, replies);
  }

  return reviews
    .filter((review) => review.parentId === null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((review) => ({
      review,
      replies: repliesByParent.get(review.id) ?? [],
    }));
}

export type ReviewThreadPage = {
  threads: ReviewThread[];
  nextCursor: string | null;
  totalCount: number;
  averageScore: number | null;
};

export async function listReviewThreadPage(
  pool: pg.Pool,
  episodeId: string,
  cursor: { createdAt: string; id: string } | null,
  pageSize = 10,
): Promise<ReviewThreadPage> {
  const cursorFilter = cursor ? "AND (created_at, id) < ($2, $3)" : "";
  const rootParams = cursor
    ? [episodeId, cursor.createdAt, cursor.id, pageSize + 1]
    : [episodeId, pageSize + 1];
  const limitParam = cursor ? "$4" : "$2";
  const [rootResult, countResult] = await Promise.all([
    pool.query<PgReviewRow>(
      `SELECT ${REVIEW_COLUMNS} FROM panel_club.reviews
       WHERE episode_id = $1 AND parent_id IS NULL ${cursorFilter}
       ORDER BY created_at DESC, id DESC LIMIT ${limitParam}`,
      rootParams,
    ),
    pool.query<{ count: string; average: string | null }>(
      "SELECT COUNT(*)::text AS count, AVG(stars)::text AS average FROM panel_club.reviews WHERE episode_id = $1 AND parent_id IS NULL",
      [episodeId],
    ),
  ]);
  const hasMore = rootResult.rows.length > pageSize;
  const rootRows = rootResult.rows.slice(0, pageSize);
  const roots = rootRows.map(pgRowToReview);
  const replyResult = roots.length
    ? await pool.query<PgReviewRow>(
        `SELECT ${REVIEW_COLUMNS} FROM panel_club.reviews WHERE parent_id = ANY($1::text[]) ORDER BY created_at ASC, id ASC`,
        [roots.map((root) => root.id)],
      )
    : { rows: [] as PgReviewRow[] };
  const repliesByParent = new Map<string, Review[]>();
  for (const row of replyResult.rows) {
    const reply = pgRowToReview(row);
    const replies = repliesByParent.get(reply.parentId!) ?? [];
    replies.push(reply);
    repliesByParent.set(reply.parentId!, replies);
  }
  const lastRoot = rootRows[rootRows.length - 1];
  return {
    threads: roots.map((review) => ({ review, replies: repliesByParent.get(review.id) ?? [] })),
    nextCursor:
      hasMore && lastRoot
        ? Buffer.from(`${lastRoot.created_at}\n${lastRoot.id}`).toString("base64url")
        : null,
    totalCount: Number(countResult.rows[0]?.count ?? 0),
    averageScore: countResult.rows[0]?.average == null ? null : Number(countResult.rows[0].average),
  };
}

export async function averageScore(pool: pg.Pool, episodeId: string): Promise<number | null> {
  const result = await pool.query<{ average: string | null }>(
    `
    SELECT AVG(stars)::text AS average
    FROM panel_club.reviews
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
