"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { createBrowserStorage, listLibrary, type LibraryRecord } from "../lib/library.ts";
import { groupLibrary, isLibraryEmpty } from "../lib/library-view.ts";
import { youtubeThumbUrl } from "../lib/thumbs.ts";

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
    <section className="grid gap-2">
      <h4 className="text-xs uppercase tracking-[0.1em] text-text-muted">{heading}</h4>
      {items.map((item) => (
        <a
          className="grid grid-cols-[160px_1fr] items-center overflow-hidden rounded-card border border-border-subtle bg-surface transition-colors duration-fast ease-out hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          href={item.href}
          key={item.episodeId}
        >
          <div className="relative aspect-video bg-[#1a1520]">
            <Image
              src={youtubeThumbUrl(item.episodeId)}
              alt={item.title}
              className="object-cover"
              fill
              sizes="160px"
            />
          </div>
          <div className="grid gap-1 px-3.5 py-3">
            <strong className="text-[17px] font-semibold tracking-tight text-text">
              {item.title}
            </strong>
            <p className="meta">{item.meta}</p>
          </div>
        </a>
      ))}
    </section>
  );
}

export function LibraryList({ continue: continueItems, history, saved }: LibraryListProps) {
  return (
    <div className="mx-auto grid max-w-[1080px] gap-5 px-5 pb-7 pt-6">
      <div>
        <h3 className="m-0 text-[26px] sm:text-4xl leading-[1.08] tracking-[-0.04em] text-text">Your library</h3>
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
    <div className="mx-auto grid max-w-[1080px] gap-3 px-5 pb-7 pt-6">
      <h3 className="m-0 text-[26px] sm:text-4xl leading-[1.08] tracking-[-0.04em] text-text">Your library</h3>
      <p className="m-0 rounded-xl bg-surface p-4.5 text-text-muted">
        Nothing in progress. You have not saved an episode.
      </p>
      <a
        className="justify-self-start text-sm font-semibold text-accent transition-colors duration-fast hover:text-accent-hover"
        href="/"
      >
        Discover shows
      </a>
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
