"use client";

import { useMemo, useState } from "react";

import type { Catalog, Show } from "../lib/catalog.ts";
import { SHOW_CATEGORIES, type ShowCategory, filterShows } from "../lib/filters.ts";
import { chipClassName } from "./chip-styles.ts";
import { SearchField } from "./search-field.tsx";
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

  const emptyLabel = query.trim() || (category !== "All shows" ? category : "");

  const filtered = useMemo(() => {
    const matched = filterShows(catalog, { query, category });
    const byName = new Map(shows.map((entry) => [entry.show.name, entry]));

    return matched
      .map((show) => byName.get(show.name))
      .filter((entry): entry is DirectoryShow => entry !== undefined);
  }, [catalog, shows, query, category]);

  return (
    <div className="mx-auto grid max-w-[1080px] gap-4 px-5 pb-7 pt-5">
      <h1 className="m-0 text-2xl leading-[1.15] tracking-[-0.02em] text-text">
        Find your kind of funny
      </h1>
      <p className="m-0 text-text-muted">{catalog.shows.length} shows. Search, then open a show.</p>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search shows, hosts, guests or episodes"
        ariaLabel="Search shows, hosts, guests or episodes"
      />

      <div className="flex flex-wrap items-center gap-2" aria-label="Categories">
        {SHOW_CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            className={chipClassName(category === value)}
            onClick={() => setCategory(value)}
          >
            {value}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="m-0 rounded-xl bg-surface p-4.5 text-text">
          <p className="m-0 text-text-muted">No shows match “{emptyLabel}”.</p>
          <button
            type="button"
            className={`${chipClassName(false)} mt-3`}
            onClick={() => {
              setQuery("");
              setCategory("All shows");
            }}
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
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
