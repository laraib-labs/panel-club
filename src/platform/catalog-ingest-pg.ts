import { randomUUID } from "node:crypto";
import type pg from "pg";

import { slugFromName } from "../lib/catalog.ts";
import type { CatalogSource } from "./catalog-db.ts";

/** SQLite ingest uses 0/1; Neon `episodes.unpublished` is BOOLEAN. */
export function episodeUnpublishedToBoolean(unpublished: number): boolean {
  return unpublished !== 0;
}

/** Cover refresh query for aired, published episodes (Postgres boolean column). */
export const REFRESH_SHOW_COVER_VIDEO_SQL = `
    SELECT youtube_video_id
    FROM episodes
    WHERE show_slug = $1
      AND status = 'aired'
      AND unpublished IS NOT TRUE
      AND youtube_video_id IS NOT NULL
    ORDER BY published_at IS NULL, published_at DESC, id DESC
    LIMIT 1
  `;

function splitGuestNames(guest: string): string[] {
  return guest
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

export async function listActiveSourcesPg(pool: pg.Pool): Promise<CatalogSource[]> {
  const result = await pool.query(`
    SELECT show_slug, kind, playlist_id, channel_id, handle, title_include, min_duration_seconds
    FROM sources
    WHERE active = TRUE
  `);

  return result.rows.map((row) => {
    const r = row as {
      show_slug: string;
      kind: "playlist" | "channel";
      playlist_id: string | null;
      channel_id: string | null;
      handle: string | null;
      title_include: string | null;
      min_duration_seconds: number;
    };
    return {
      showId: r.show_slug,
      kind: r.kind,
      playlistId: r.playlist_id,
      channelId: r.channel_id,
      handle: r.handle,
      titleInclude: r.title_include,
      minDurationSeconds: r.min_duration_seconds,
    };
  });
}

export async function startIngestRunPg(pool: pg.Pool): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `
    INSERT INTO ingest_runs (id, started_at, inserted, skipped, updated, unpublished, errors)
    VALUES ($1, $2, 0, 0, 0, 0, 0)
  `,
    [id, new Date().toISOString()],
  );
  return id;
}

export async function finishIngestRunPg(
  pool: pg.Pool,
  runId: string,
  stats: { inserted: number; skipped: number; updated: number; unpublished: number; errors: number },
): Promise<void> {
  await pool.query(
    `
    UPDATE ingest_runs
    SET finished_at = $1, inserted = $2, skipped = $3, updated = $4, unpublished = $5, errors = $6
    WHERE id = $7
  `,
    [
      new Date().toISOString(),
      stats.inserted,
      stats.skipped,
      stats.updated,
      stats.unpublished,
      stats.errors,
      runId,
    ],
  );
}

export async function recordIngestItemPg(
  pool: pg.Pool,
  runId: string,
  item: { videoId: string; showId: string; status: string; detail: string },
): Promise<void> {
  await pool.query(
    `
    INSERT INTO ingest_items (run_id, video_id, show_slug, status, detail)
    VALUES ($1, $2, $3, $4, $5)
  `,
    [runId, item.videoId, item.showId, item.status, item.detail],
  );
}

async function upsertPersonPg(client: pg.PoolClient, name: string): Promise<string> {
  const slug = slugFromName(name);
  await client.query("INSERT INTO people (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING", [
    slug,
    name,
  ]);
  return slug;
}

async function replaceEpisodeGuestsPg(client: pg.PoolClient, episodeId: string, guest: string): Promise<void> {
  await client.query("DELETE FROM episode_credits WHERE episode_id = $1 AND role = 'guest'", [episodeId]);
  for (const name of splitGuestNames(guest)) {
    const personSlug = await upsertPersonPg(client, name);
    await client.query(
      "INSERT INTO episode_credits (episode_id, person_slug, role) VALUES ($1, $2, 'guest') ON CONFLICT DO NOTHING",
      [episodeId, personSlug],
    );
  }
}

export async function upsertEpisodePg(
  pool: pg.Pool,
  episode: {
    videoId: string;
    showId: string;
    title: string;
    guest: string;
    durationSeconds: number;
    publishedAt: string | null;
    status: "aired" | "upcoming";
    unpublished: number;
    premieresAt: string | null;
  },
): Promise<"inserted" | "updated"> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id FROM episodes WHERE youtube_video_id = $1 OR id = $2",
      [episode.videoId, episode.videoId],
    );
    const hadRow = existing.rows.length > 0;

    await client.query(
      `
      INSERT INTO episodes (id, show_slug, youtube_video_id, title, duration_seconds, status, unpublished, premieres_at, media_url, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9)
      ON CONFLICT (youtube_video_id) DO UPDATE SET
        title = EXCLUDED.title,
        duration_seconds = EXCLUDED.duration_seconds,
        status = EXCLUDED.status,
        unpublished = EXCLUDED.unpublished,
        premieres_at = EXCLUDED.premieres_at,
        published_at = EXCLUDED.published_at
    `,
      [
        episode.videoId,
        episode.showId,
        episode.videoId,
        episode.title,
        episode.durationSeconds,
        episode.status,
        episodeUnpublishedToBoolean(episode.unpublished),
        episode.premieresAt,
        episode.publishedAt,
      ],
    );

    const episodeId =
      hadRow ? ((existing.rows[0] as { id: string }).id) : episode.videoId;
    await replaceEpisodeGuestsPg(client, episodeId, episode.guest);
    await client.query("COMMIT");
    return hadRow ? "updated" : "inserted";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function refreshShowCoverVideoPg(pool: pg.Pool, showId: string): Promise<void> {
  const result = await pool.query(REFRESH_SHOW_COVER_VIDEO_SQL, [showId]);

  const row = result.rows[0] as { youtube_video_id: string } | undefined;
  if (row?.youtube_video_id) {
    await pool.query("UPDATE shows SET cover_video_id = $1 WHERE slug = $2", [row.youtube_video_id, showId]);
  }
}
