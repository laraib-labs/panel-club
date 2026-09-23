"use client";

import { useEffect, useState } from "react";

import { createBrowserStorage, listLibrary, type LibraryRecord } from "../lib/library.ts";
import { groupLibrary, isLibraryEmpty } from "../lib/library-view.ts";

export type LibraryEpisodeItem = {
  episodeId: string;
  title: string;
  meta: string;
  href: string;
};

export type LibraryListProps = {
  continue: LibraryEpisodeItem[];
  history: LibraryEpisodeItem[];
  saved: LibraryEpisodeItem[];
};

type EpisodeRef = {
  episodeId: string;
  title: string;
  href: string;
};

type LibraryBrowserProps = {
  episodes: EpisodeRef[];
};

function formatContinueMeta(positionSeconds: number): string {
  const minutes = Math.floor(positionSeconds / 60);
  return `${minutes} min in · not finished`;
}

function EpisodeSection({
  heading,
  items,
}: {
  heading: string;
  items: LibraryEpisodeItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <h4>{heading}</h4>
      {items.map((item) => (
        <a className="ep" href={item.href} key={item.episodeId}>
          <strong>{item.title}</strong>
          <p className="meta">{item.meta}</p>
        </a>
      ))}
    </>
  );
}

export function LibraryList({ continue: continueItems, history, saved }: LibraryListProps) {
  return (
    <div className="pad">
      <div>
        <h3>Your library</h3>
        <p className="meta">Stored in this browser. Not an account.</p>
      </div>
      <EpisodeSection heading="Continue" items={continueItems} />
      <EpisodeSection heading="History" items={history} />
      <EpisodeSection heading="Watchlist" items={saved} />
    </div>
  );
}

function LibraryEmpty() {
  return (
    <div className="pad">
      <h3>Your library</h3>
      <p className="empty">Nothing in progress. You have not saved an episode.</p>
      <a href="/">Discover shows</a>
    </div>
  );
}

function mapRecords(
  records: LibraryRecord[],
  lookup: Map<string, EpisodeRef>,
  meta: (record: LibraryRecord) => string,
): LibraryEpisodeItem[] {
  return records.flatMap((record) => {
    const episode = lookup.get(record.episodeId);
    if (!episode) {
      return [];
    }
    return [{ ...episode, meta: meta(record) }];
  });
}

export function LibraryBrowser({ episodes }: LibraryBrowserProps) {
  const [records, setRecords] = useState<LibraryRecord[] | null>(null);

  useEffect(() => {
    setRecords(listLibrary(createBrowserStorage()));
  }, []);

  const lookup = new Map(episodes.map((episode) => [episode.episodeId, episode]));
  const grouped = groupLibrary(records ?? []);

  if (records === null || isLibraryEmpty(grouped)) {
    return <LibraryEmpty />;
  }

  return (
    <LibraryList
      continue={mapRecords(grouped.continue, lookup, (record) =>
        formatContinueMeta(record.positionSeconds),
      )}
      history={mapRecords(grouped.history, lookup, () => "Finished")}
      saved={mapRecords(grouped.saved, lookup, () => "Saved")}
    />
  );
}
