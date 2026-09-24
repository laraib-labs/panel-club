"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { filterPeople, personMonogram, type Person } from "../lib/people-view.ts";

export type PeopleListProps = {
  people: Person[];
};

export function PeopleList({ people }: PeopleListProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterPeople(people, query), [people, query]);
  const emptyLabel = query.trim();

  return (
    <div className="pad">
      <h3>People</h3>
      <p className="meta">Hosts and guests across the 16 shows.</p>

      <label className="people-search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people"
          aria-label="Search people"
        />
      </label>

      {filtered.length === 0 ? (
        <div className="empty">
          <p className="people-empty">No people match “{emptyLabel}”.</p>
          <button type="button" className="filter-btn" onClick={() => setQuery("")}>
            Clear
          </button>
        </div>
      ) : (
        <div className="people-grid">
          {filtered.map((person) => (
            <Link className="people-card" href={`/people/${person.slug}`} key={person.slug}>
              <span className="people-monogram" aria-hidden="true">
                {personMonogram(person.name)}
              </span>
              <strong>{person.name}</strong>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
