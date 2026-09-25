"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { filterPeople, personMonogram, type Person } from "../lib/people-view.ts";
import { chipClassName } from "./chip-styles.ts";
import { SearchField } from "./search-field.tsx";

export type PeopleListProps = {
  people: Person[];
};

export function PeopleList({ people }: PeopleListProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterPeople(people, query), [people, query]);
  const emptyLabel = query.trim();

  return (
    <div className="mx-auto grid max-w-[1080px] gap-4 px-5 pb-7 pt-6">
      <h3 className="m-0 text-[26px] sm:text-4xl leading-[1.08] tracking-[-0.04em] text-text">People</h3>
      <p className="m-0 text-text-muted">Hosts and guests across the 16 shows.</p>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search people"
        ariaLabel="Search people"
      />

      {filtered.length === 0 ? (
        <div className="m-0 rounded-xl bg-surface p-4.5 text-text">
          <p className="m-0 text-text-muted">No people match “{emptyLabel}”.</p>
          <button
            type="button"
            className={`${chipClassName(false)} mt-3`}
            onClick={() => setQuery("")}
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {filtered.map((person) => (
            <Link
              className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface px-3.5 py-3 transition-colors duration-fast ease-out hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              href={`/people/${person.slug}`}
              key={person.slug}
            >
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface-raised font-extrabold text-accent"
              >
                {personMonogram(person.name)}
              </span>
              <strong className="font-semibold text-text">{person.name}</strong>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
