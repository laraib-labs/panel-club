import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type pg from "pg";

import type { Catalog } from "../lib/catalog.ts";
import { slugFromName } from "../lib/catalog.ts";
import {
  loadIngestRules,
  loadSeedCatalog,
  seedCatalog,
  type IngestRules,
} from "./catalog-db.ts";
import { applySqliteCatalogSchema } from "./migrate.ts";
import { createCatalogPool } from "./pg.ts";
import { parseSourceUrl } from "./youtube/source-url.ts";

export { seedCatalog };

function splitHostNames(host: string): string[] {
  return host
    .split(" & ")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function splitGuestNames(guest: string): string[] {
  return guest
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

export function seedSqliteFile(dbPath: string): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    applySqliteCatalogSchema(db);
    seedCatalog(db, loadSeedCatalog(), loadIngestRules());
  } finally {
    db.close();
  }
}

export async function seedPostgres(pool: pg.Pool, catalog: Catalog, rules: IngestRules): Promise<void> {
  const existing = await pool.query("SELECT COUNT(*)::int AS n FROM shows");
  if ((existing.rows[0] as { n: number }).n > 0) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const show of catalog.shows) {
      const slug = slugFromName(show.name);
      await client.query(
        `INSERT INTO shows (slug, name, category, description, cover_video_id, availability_note, checked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          slug,
          show.name,
          show.category,
          show.description,
          show.coverVideoId,
          show.availabilityNote,
          show.checkedAt,
        ],
      );

      for (const name of splitHostNames(show.host)) {
        const personSlug = slugFromName(name);
        await client.query("INSERT INTO people (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING", [
          personSlug,
          name,
        ]);
        await client.query(
          "INSERT INTO show_credits (show_slug, person_slug, role) VALUES ($1, $2, 'host') ON CONFLICT DO NOTHING",
          [slug, personSlug],
        );
      }

      const parsed = parseSourceUrl(show.sourceUrl);
      const rule = rules.shows[slug] ?? {};
      const titleInclude = rule.titleInclude ?? (parsed.kind === "channel" ? show.name : null);
      await client.query(
        `INSERT INTO sources (id, show_slug, kind, playlist_id, channel_id, handle, title_include, min_duration_seconds, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)`,
        [
          `${slug}:primary`,
          slug,
          parsed.kind,
          parsed.playlistId,
          parsed.channelId,
          parsed.handle,
          titleInclude,
          rule.minDurationSeconds ?? rules.defaultMinDurationSeconds,
        ],
      );

      for (const episode of show.episodes) {
        await client.query(
          `INSERT INTO episodes (id, show_slug, youtube_video_id, title, duration_seconds, status, unpublished, premieres_at, media_url, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8, NULL)`,
          [
            episode.videoId,
            slug,
            episode.videoId,
            episode.title,
            episode.duration,
            episode.status,
            episode.premieresAt ?? null,
            episode.mediaUrl,
          ],
        );
        for (const name of splitGuestNames(episode.guest)) {
          const personSlug = slugFromName(name);
          await client.query("INSERT INTO people (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING", [
            personSlug,
            name,
          ]);
          await client.query(
            "INSERT INTO episode_credits (episode_id, person_slug, role) VALUES ($1, $2, 'guest') ON CONFLICT DO NOTHING",
            [episode.videoId, personSlug],
          );
        }
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const isMain = process.argv[1]?.includes("seed.ts");

if (isMain) {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = createCatalogPool(url);
    try {
      await seedPostgres(pool, loadSeedCatalog(), loadIngestRules());
      const count = await pool.query("SELECT COUNT(*)::int AS n FROM shows");
      console.log(JSON.stringify({ shows: count.rows[0] }));
    } finally {
      await pool.end();
    }
  } else {
    const dbPath = join(process.cwd(), "data", "panel-club-catalog.sqlite");
    seedSqliteFile(dbPath);
    console.log(JSON.stringify({ db: dbPath, seeded: true }));
  }
}
