import type { Catalog, Episode, Show } from "./catalog.ts";

export type UpcomingEntry = {
  show: Show;
  episode: Episode;
};

export type AiredEntry = {
  show: Show;
  episodeCount: number;
};

export type SplitSchedule = {
  upcoming: UpcomingEntry[];
  aired: AiredEntry[];
};

function comparePremieresAt(left: Episode, right: Episode): number {
  const leftDate = left.premieresAt;
  const rightDate = right.premieresAt;

  if (leftDate && rightDate) {
    return leftDate.localeCompare(rightDate);
  }
  if (leftDate) {
    return -1;
  }
  if (rightDate) {
    return 1;
  }
  return 0;
}

export function splitSchedule(catalog: Catalog): SplitSchedule {
  const upcoming: UpcomingEntry[] = [];
  const aired: AiredEntry[] = [];

  for (const show of catalog.shows) {
    let airedCount = 0;

    for (const episode of show.episodes) {
      if (episode.status === "upcoming") {
        upcoming.push({ show, episode });
        continue;
      }

      if (episode.status === "aired") {
        airedCount += 1;
      }
    }

    if (airedCount > 0) {
      aired.push({ show, episodeCount: airedCount });
    }
  }

  upcoming.sort((left, right) => comparePremieresAt(left.episode, right.episode));

  return { upcoming, aired };
}
