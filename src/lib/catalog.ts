import type pg from "pg";

import { loadSeedCatalog } from "../platform/catalog-db.ts";
import { createCatalogPool } from "../platform/pg.ts";

export type EpisodeStatus = "aired" | "upcoming";

export type Episode = {
  title: string;
  videoId: string;
  guest: string;
  duration: number;
  status: EpisodeStatus;
  premieresAt?: string;
  mediaUrl: string | null;
};

export type Show = {
  name: string;
  host: string;
  category: string;
  description: string;
  coverVideoId: string;
  sourceUrl: string;
  checkedAt: string;
  availabilityNote: string;
  episodes: Episode[];
};

export type Catalog = {
  shows: Show[];
};

let catalogPool: pg.Pool | null = null;

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
  premieres_at: string | null;
  media_url: string | null;
};

type SourceRow = {
  show_slug: string;
  kind: "playlist" | "channel";
  playlist_id: string | null;
  channel_id: string | null;
  handle: string | null;
};

export function slugFromName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** JSON seed reader for unit tests only (no DATABASE_URL). */
export function loadCatalog(): Catalog {
  if (process.env.DATABASE_URL) {
    throw new Error("loadCatalog() is test-only; use loadAppCatalog() when DATABASE_URL is set");
  }

  return loadSeedCatalog();
}

function getCatalogPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for loadAppCatalog()");
  }

  if (!catalogPool) {
    catalogPool = createCatalogPool(connectionString);
  }

  return catalogPool;
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

function catalogToViewFromRows(
  shows: ShowRow[],
  episodes: EpisodeRow[],
  sources: SourceRow[],
  hosts: Array<{ show_slug: string; name: string }>,
  guests: Array<{ episode_id: string; name: string }>,
): Catalog {
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

async function catalogToViewPg(pool: pg.Pool): Promise<Catalog> {
  const [showsResult, episodesResult, sourcesResult, hostsResult, guestsResult] = await Promise.all([
    pool.query<ShowRow>("SELECT * FROM panel_club.shows ORDER BY name"),
    pool.query<EpisodeRow>("SELECT * FROM panel_club.episodes"),
    pool.query<SourceRow>(
      "SELECT show_slug, kind, playlist_id, channel_id, handle FROM panel_club.sources",
    ),
    pool.query<{ show_slug: string; name: string }>(`
      SELECT sc.show_slug, p.name
      FROM panel_club.show_credits sc
      JOIN panel_club.people p ON p.slug = sc.person_slug
      WHERE sc.role = 'host'
      ORDER BY sc.show_slug, p.name
    `),
    pool.query<{ episode_id: string; name: string }>(`
      SELECT ec.episode_id, p.name
      FROM panel_club.episode_credits ec
      JOIN panel_club.people p ON p.slug = ec.person_slug
      WHERE ec.role = 'guest'
      ORDER BY ec.episode_id, p.name
    `),
  ]);

  return catalogToViewFromRows(
    showsResult.rows,
    episodesResult.rows,
    sourcesResult.rows,
    hostsResult.rows,
    guestsResult.rows,
  );
}

export async function loadAppCatalog(): Promise<Catalog> {
  return catalogToViewPg(getCatalogPool());
}

export function getShow(catalog: Catalog, slug: string): Show | undefined {
  return catalog.shows.find((show) => slugFromName(show.name) === slug);
}

export function getEpisode(show: Show, episodeId: string): Episode | undefined {
  return show.episodes.find((episode) => episode.videoId === episodeId);
}
