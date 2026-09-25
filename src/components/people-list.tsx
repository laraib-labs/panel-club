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
  const [role, setRole] = useState<"all" | "hosts" | "guests">("all");
  const filtered = useMemo(
    () =>
      filterPeople(people, query).filter((person) =>
        role === "all" || (role === "hosts" ? person.hostedShowCount > 0 : person.guestEpisodeCount > 0),
      ),
    [people, query, role],
  );
  const emptyLabel = query.trim();

  return (
    <div className="mx-auto grid max-w-[1080px] gap-4 px-5 pb-7 pt-6">
      <h3 className="m-0 text-[26px] sm:text-4xl leading-[1.08] tracking-[-0.04em] text-text">People</h3>
      <p className="m-0 text-text-muted">Browse the hosts and guests behind the shows.</p>
      <div className="flex flex-wrap gap-2 text-xs text-text-muted">
        <span className="rounded-pill bg-surface px-3 py-1.5">{people.length} people</span>
        <span className="rounded-pill bg-surface px-3 py-1.5">Filter by name or role</span>
      </div>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search people"
        ariaLabel="Search people"
      />
      <div className="flex flex-wrap gap-2" aria-label="Filter people by role">
        {(["all", "hosts", "guests"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={role === value}
            className={`${chipClassName(role === value)} capitalize`}
            onClick={() => setRole(value)}>{value === "all" ? "Everyone" : value}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="m-0 rounded-xl bg-surface p-4.5 text-text">
          <p className="m-0 text-text-muted">No people match “{emptyLabel}”.</p>
          <button
            type="button"
            className={`${chipClassName(false)} mt-3`}
            onClick={() => { setQuery(""); setRole("all"); }}
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {filtered.map((person) => (
            <Link
              className="group flex items-center gap-3 rounded-card border border-border-subtle bg-surface px-3.5 py-3 transition-all duration-base ease-out hover:-translate-y-0.5 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              href={`/people/${person.slug}`}
              key={person.slug}
            >
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface-raised font-extrabold text-accent transition-colors group-hover:bg-accent-muted"
              >
                {personMonogram(person.name)}
              </span>
              <span className="grid gap-1">
                <strong className="font-semibold text-text">{person.name}</strong>
                <span className="text-xs text-text-muted">
                  {person.hostedShowCount > 0 ? `${person.hostedShowCount} show${person.hostedShowCount === 1 ? "" : "s"} hosting` : "Guest"}
                  {person.guestEpisodeCount > 0 ? ` · ${person.guestEpisodeCount} guest appearance${person.guestEpisodeCount === 1 ? "" : "s"}` : ""}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
