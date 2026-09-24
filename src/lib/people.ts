import type { Catalog, Episode, Show } from "./catalog.ts";
import { slugFromName } from "./catalog.ts";
import type { Person } from "./people-view.ts";

export type { Person } from "./people-view.ts";

export type EpisodeAppearance = {
  show: Show;
  episode: Episode;
};

export type PersonAppearances = {
  name: string;
  slug: string;
  hosted: EpisodeAppearance[];
  guested: EpisodeAppearance[];
};

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

function personFromName(name: string): Person {
  return { name, slug: slugFromName(name) };
}

export function listPeople(catalog: Catalog): Person[] {
  const bySlug = new Map<string, Person>();

  for (const show of catalog.shows) {
    for (const name of splitHostNames(show.host)) {
      const person = personFromName(name);
      bySlug.set(person.slug, person);
    }

    for (const episode of show.episodes) {
      for (const name of splitGuestNames(episode.guest)) {
        const person = personFromName(name);
        bySlug.set(person.slug, person);
      }
    }
  }

  return [...bySlug.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function appearances(catalog: Catalog, slug: string): PersonAppearances | undefined {
  const people = listPeople(catalog);
  const person = people.find((entry) => entry.slug === slug);
  if (!person) {
    return undefined;
  }

  const hosted: EpisodeAppearance[] = [];
  const guested: EpisodeAppearance[] = [];

  for (const show of catalog.shows) {
    const hosts = splitHostNames(show.host);
    if (hosts.includes(person.name)) {
      for (const episode of show.episodes) {
        hosted.push({ show, episode });
      }
    }

    for (const episode of show.episodes) {
      if (splitGuestNames(episode.guest).includes(person.name)) {
        guested.push({ show, episode });
      }
    }
  }

  return {
    name: person.name,
    slug: person.slug,
    hosted,
    guested,
  };
}
