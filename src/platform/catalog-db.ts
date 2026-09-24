import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

import type { Catalog, Episode, Show } from "../lib/catalog.ts";
import { slugFromName } from "../lib/catalog.ts";
import { applySqliteCatalogSchema } from "./migrate.ts";
import { parseSourceUrl } from "./youtube/source-url.ts";

export type IngestRules = {
  defaultMinDurationSeconds: number;
  shows: Record<string, { titleInclude?: string; minDurationSeconds?: number }>;
};

export type CatalogSource = {
  showId: string;
  kind: "playlist" | "channel";
  playlistId: string | null;
  channelId: string | null;
  handle: string | null;
  titleInclude: string | null;
  minDurationSeconds: number;
};

type ShowRow = {
  slug: string;
  name: string;
  category: string;
  description: string;
  cover_video_id: string;
  checked_at: string;
  availability_note: string;
};

type EpisodeRow = {
  id: string;
  show_slug: string;
  youtube_video_id: string | null;
  title: string;
  duration_seconds: number;
  status: "aired" | "upcoming";
  unpublished: number;
  premieres_at: string | null;
  media_url: string | null;
  published_at: string | null;
};

type SourceRow = {
  show_slug: string;
  kind: "playlist" | "channel";
  playlist_id: string | null;
  channel_id: string | null;
  handle: string | null;
};

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function loadIngestRules(path = join(rootDir, "content/ingest-rules.json")): IngestRules {
  return JSON.parse(readFileSync(path, "utf8")) as IngestRules;
}

export function loadSeedCatalog(path = join(rootDir, "content/catalog.json")): Catalog {
  return JSON.parse(readFileSync(path, "utf8")) as Catalog;
}

export function openMemoryCatalogDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  applySqliteCatalogSchema(db);
  return db;
}

export function ensureCatalogSchema(db: DatabaseSync): void {
  applySqliteCatalogSchema(db);
}

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

function upsertPerson(db: DatabaseSync, name: string): string {
  const slug = slugFromName(name);
  db.prepare("INSERT OR IGNORE INTO people (slug, name) VALUES (?, ?)").run(slug, name);
  return slug;
}

function addShowCredit(db: DatabaseSync, showSlug: string, name: string, role: "host" | "guest"): void {
  const personSlug = upsertPerson(db, name);
  db.prepare(
    "INSERT OR IGNORE INTO show_credits (show_slug, person_slug, role) VALUES (?, ?, ?)",
  ).run(showSlug, personSlug, role);
}

function replaceEpisodeGuests(db: DatabaseSync, episodeId: string, guest: string): void {
  db.prepare("DELETE FROM episode_credits WHERE episode_id = ? AND role = 'guest'").run(episodeId);
  for (const name of splitGuestNames(guest)) {
    const personSlug = upsertPerson(db, name);
    db.prepare(
      "INSERT OR IGNORE INTO episode_credits (episode_id, person_slug, role) VALUES (?, ?, 'guest')",
    ).run(episodeId, personSlug);
  }
}

function sourceUrlFromRow(row: SourceRow): string {
  if (row.playlist_id) {
    return `https://www.youtube.com/playlist?list=${row.playlist_id}`;
  }

  if (row.handle) {
    return `https://www.youtube.com/@${row.handle}/videos`;
  }

  if (row.channel_id) {
    return `https://www.youtube.com/channel/${row.channel_id}`;
  }

  return "";
}

export function seedCatalog(db: DatabaseSync, catalog: Catalog, rules: IngestRules): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM shows").get() as { n: number };
  if (count.n > 0) {
    return;
  }

  const insertShow = db.prepare(`
    INSERT INTO shows (slug, name, category, description, cover_video_id, availability_note, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSource = db.prepare(`
    INSERT INTO sources (id, show_slug, kind, playlist_id, channel_id, handle, title_include, min_duration_seconds, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const insertEpisodeRow = db.prepare(`
    INSERT INTO episodes (id, show_slug, youtube_video_id, title, duration_seconds, status, unpublished, premieres_at, media_url, published_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)
  `);

  for (const show of catalog.shows) {
    const slug = slugFromName(show.name);
    insertShow.run(
      slug,
      show.name,
      show.category,
      show.description,
      show.coverVideoId,
      show.availabilityNote,
      show.checkedAt,
    );

    for (const name of splitHostNames(show.host)) {
      addShowCredit(db, slug, name, "host");
    }

    const parsed = parseSourceUrl(show.sourceUrl);
    const rule = rules.shows[slug] ?? {};
    const titleInclude = rule.titleInclude ?? (parsed.kind === "channel" ? show.name : null);
    insertSource.run(
      `${slug}:primary`,
      slug,
      parsed.kind,
      parsed.playlistId,
      parsed.channelId,
      parsed.handle,
      titleInclude,
      rule.minDurationSeconds ?? rules.defaultMinDurationSeconds,
    );

    for (const episode of show.episodes) {
      const episodeId = episode.videoId;
      insertEpisodeRow.run(
        episodeId,
        slug,
        episode.videoId,
        episode.title,
        episode.duration,
        episode.status,
        episode.premieresAt ?? null,
        episode.mediaUrl,
      );
      replaceEpisodeGuests(db, episodeId, episode.guest);
    }
  }
}

export function listActiveSources(db: DatabaseSync): CatalogSource[] {
  const rows = db.prepare(`
    SELECT show_slug, kind, playlist_id, channel_id, handle, title_include, min_duration_seconds
    FROM sources WHERE active = 1
  `).all() as Array<{
    show_slug: string;
    kind: "playlist" | "channel";
    playlist_id: string | null;
    channel_id: string | null;
    handle: string | null;
    title_include: string | null;
    min_duration_seconds: number;
  }>;

  return rows.map((row) => ({
    showId: row.show_slug,
    kind: row.kind,
    playlistId: row.playlist_id,
    channelId: row.channel_id,
    handle: row.handle,
    titleInclude: row.title_include,
    minDurationSeconds: row.min_duration_seconds,
  }));
}

export function hasEpisode(db: DatabaseSync, videoId: string): boolean {
  const row = db
    .prepare("SELECT 1 AS ok FROM episodes WHERE id = ? OR youtube_video_id = ?")
    .get(videoId, videoId) as { ok: number } | undefined;
  return Boolean(row);
}

export function insertEpisode(
  db: DatabaseSync,
  episode: {
    videoId: string;
    showId: string;
    title: string;
    guest: string;
    durationSeconds: number;
    publishedAt: string | null;
  },
): void {
  upsertEpisode(db, {
    ...episode,
    status: "aired",
    unpublished: 0,
    premieresAt: null,
  });
}

export function upsertEpisode(
  db: DatabaseSync,
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
): "inserted" | "updated" {
  const existing = db
    .prepare("SELECT id FROM episodes WHERE youtube_video_id = ? OR id = ?")
    .get(episode.videoId, episode.videoId) as { id: string } | undefined;

  db.prepare(`
    INSERT INTO episodes (id, show_slug, youtube_video_id, title, duration_seconds, status, unpublished, premieres_at, media_url, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    ON CONFLICT(youtube_video_id) DO UPDATE SET
      title = excluded.title,
      duration_seconds = excluded.duration_seconds,
      status = excluded.status,
      unpublished = excluded.unpublished,
      premieres_at = excluded.premieres_at,
      published_at = excluded.published_at
  `).run(
    episode.videoId,
    episode.showId,
    episode.videoId,
    episode.title,
    episode.durationSeconds,
    episode.status,
    episode.unpublished,
    episode.premieresAt,
    episode.publishedAt,
  );

  const episodeId = existing?.id ?? episode.videoId;
  replaceEpisodeGuests(db, episodeId, episode.guest);
  return existing ? "updated" : "inserted";
}

export function refreshShowCoverVideo(db: DatabaseSync, showId: string): void {
  const row = db.prepare(`
    SELECT youtube_video_id
    FROM episodes
    WHERE show_slug = ?
      AND status = 'aired'
      AND unpublished = 0
      AND youtube_video_id IS NOT NULL
    ORDER BY published_at IS NULL, published_at DESC, id DESC
    LIMIT 1
  `).get(showId) as { youtube_video_id: string } | undefined;

  if (row?.youtube_video_id) {
    db.prepare("UPDATE shows SET cover_video_id = ? WHERE slug = ?").run(row.youtube_video_id, showId);
  }
}

export function startIngestRun(db: DatabaseSync): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO ingest_runs (id, started_at, inserted, skipped, updated, unpublished, errors)
    VALUES (?, ?, 0, 0, 0, 0, 0)
  `).run(id, new Date().toISOString());
  return id;
}

export function finishIngestRun(
  db: DatabaseSync,
  runId: string,
  stats: { inserted: number; skipped: number; updated: number; unpublished: number; errors: number },
): void {
  db.prepare(`
    UPDATE ingest_runs
    SET finished_at = ?, inserted = ?, skipped = ?, updated = ?, unpublished = ?, errors = ?
    WHERE id = ?
  `).run(
    new Date().toISOString(),
    stats.inserted,
    stats.skipped,
    stats.updated,
    stats.unpublished,
    stats.errors,
    runId,
  );
}

export function recordIngestItem(
  db: DatabaseSync,
  runId: string,
  item: { videoId: string; showId: string; status: string; detail: string },
): void {
  db.prepare(`
    INSERT INTO ingest_items (run_id, video_id, show_slug, status, detail)
    VALUES (?, ?, ?, ?, ?)
  `).run(runId, item.videoId, item.showId, item.status, item.detail);
}

export function catalogToView(db: DatabaseSync): Catalog {
  const shows = db.prepare("SELECT * FROM shows ORDER BY name").all() as ShowRow[];
  const episodes = db.prepare("SELECT * FROM episodes").all() as EpisodeRow[];
  const sources = db.prepare("SELECT show_slug, kind, playlist_id, channel_id, handle FROM sources").all() as SourceRow[];
  const hosts = db.prepare(`
    SELECT sc.show_slug, p.name
    FROM show_credits sc
    JOIN people p ON p.slug = sc.person_slug
    WHERE sc.role = 'host'
    ORDER BY sc.show_slug, p.name
  `).all() as Array<{ show_slug: string; name: string }>;
  const guests = db.prepare(`
    SELECT ec.episode_id, p.name
    FROM episode_credits ec
    JOIN people p ON p.slug = ec.person_slug
    WHERE ec.role = 'guest'
    ORDER BY ec.episode_id, p.name
  `).all() as Array<{ episode_id: string; name: string }>;

  const hostsByShow = new Map<string, string[]>();
  for (const row of hosts) {
    const list = hostsByShow.get(row.show_slug) ?? [];
    list.push(row.name);
    hostsByShow.set(row.show_slug, list);
  }

  const guestsByEpisode = new Map<string, string[]>();
  for (const row of guests) {
    const list = guestsByEpisode.get(row.episode_id) ?? [];
    list.push(row.name);
    guestsByEpisode.set(row.episode_id, list);
  }

  const sourceByShow = new Map<string, SourceRow>();
  for (const row of sources) {
    if (!sourceByShow.has(row.show_slug)) {
      sourceByShow.set(row.show_slug, row);
    }
  }

  const byShow = new Map<string, Episode[]>();
  for (const episode of episodes) {
    const videoId = episode.youtube_video_id ?? episode.id;
    const list = byShow.get(episode.show_slug) ?? [];
    list.push({
      title: episode.title,
      videoId,
      guest: (guestsByEpisode.get(episode.id) ?? []).join(", "),
      duration: episode.duration_seconds,
      status: episode.status,
      premieresAt: episode.premieres_at ?? undefined,
      mediaUrl: episode.media_url,
    });
    byShow.set(episode.show_slug, list);
  }

  return {
    shows: shows.map((show): Show => ({
      name: show.name,
      host: (hostsByShow.get(show.slug) ?? []).join(" & "),
      category: show.category,
      description: show.description,
      coverVideoId: show.cover_video_id,
      sourceUrl: sourceByShow.has(show.slug) ? sourceUrlFromRow(sourceByShow.get(show.slug) as SourceRow) : "",
      checkedAt: show.checked_at,
      availabilityNote: show.availability_note,
      episodes: byShow.get(show.slug) ?? [],
    })),
  };
}
