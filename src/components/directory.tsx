"use client";

import { useMemo, useState } from "react";

import type { Catalog, Show } from "../lib/catalog.ts";
import { SHOW_CATEGORIES, type ShowCategory, filterShows } from "../lib/filters.ts";
import { ShowCard } from "./show-card.tsx";

export type DirectoryShow = {
  show: Show;
  slug: string;
  averageScore: number | null;
};

type DirectoryProps = {
  catalog: Catalog;
  shows: DirectoryShow[];
};

export function Directory({ catalog, shows }: DirectoryProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ShowCategory>("All shows");

  const filtered = useMemo(() => {
    const matched = filterShows(catalog, { query, category });
    const byName = new Map(shows.map((entry) => [entry.show.name, entry]));

    return matched
      .map((show) => byName.get(show.name))
      .filter((entry): entry is DirectoryShow => entry !== undefined);
  }, [catalog, shows, query, category]);

  return (
    <div className="pad">
      <h3>Find your kind of funny</h3>
      <p className="meta">{catalog.shows.length} shows. Search, then open a show.</p>

      <label className="search-row">
        <span className="meta">Search</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search shows, hosts, guests or episodes"
          aria-label="Search shows, hosts, guests or episodes"
        />
      </label>

      <div className="filters" aria-label="Categories">
        {SHOW_CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            className={category === value ? "filter-btn on" : "filter-btn"}
            onClick={() => setCategory(value)}
          >
            {value}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="empty note">No shows match</p>
      ) : (
        <div className="grid">
          {filtered.map((entry) => (
            <ShowCard
              key={entry.slug}
              show={entry.show}
              slug={entry.slug}
              averageScore={entry.averageScore}
            />
          ))}
        </div>
      )}
    </div>
  );
}
