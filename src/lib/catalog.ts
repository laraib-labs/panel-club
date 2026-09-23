import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const catalogPath = join(dirname(fileURLToPath(import.meta.url)), "../../content/catalog.json");

export function slugFromName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function loadCatalog(): Catalog {
  const raw = readFileSync(catalogPath, "utf8");
  return JSON.parse(raw) as Catalog;
}

export function getShow(catalog: Catalog, slug: string): Show | undefined {
  return catalog.shows.find((show) => slugFromName(show.name) === slug);
}

export function getEpisode(show: Show, episodeId: string): Episode | undefined {
  return show.episodes.find((episode) => episode.videoId === episodeId);
}
