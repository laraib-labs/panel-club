import type { Catalog, Show } from "./catalog.ts";

export const SHOW_CATEGORIES = [
  "All shows",
  "Panel shows",
  "Game shows",
  "Roasts",
  "Advice & banter",
] as const;

export type ShowCategory = (typeof SHOW_CATEGORIES)[number];

export type FilterOptions = {
  query: string;
  category: ShowCategory;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function showMatchesQuery(show: Show, query: string): boolean {
  const needle = normalize(query);
  if (needle.length === 0) {
    return true;
  }

  if (normalize(show.name).includes(needle)) {
    return true;
  }

  if (normalize(show.host).includes(needle)) {
    return true;
  }

  for (const episode of show.episodes) {
    if (normalize(episode.title).includes(needle)) {
      return true;
    }

    if (episode.guest.length > 0 && normalize(episode.guest).includes(needle)) {
      return true;
    }
  }

  return false;
}

export function filterShows(catalog: Catalog, options: FilterOptions): Show[] {
  const query = options.query;

  return catalog.shows.filter((show) => {
    if (options.category !== "All shows" && show.category !== options.category) {
      return false;
    }

    return showMatchesQuery(show, query);
  });
}
