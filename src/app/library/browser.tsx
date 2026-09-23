"use client";

import { useEffect, useState } from "react";

import { LibraryList } from "../../components/library-list.tsx";
import { SiteHeader } from "../../components/site-header.tsx";
import { createBrowserStorage, listLibrary, type LibraryRecord } from "../../lib/library.ts";
import { groupLibrary, isLibraryEmpty } from "../../lib/library-view.ts";

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

export function LibraryBrowser({ episodes }: LibraryBrowserProps) {
  const [records, setRecords] = useState<LibraryRecord[] | null>(null);

  useEffect(() => {
    setRecords(listLibrary(createBrowserStorage()));
  }, []);

  const lookup = new Map(episodes.map((episode) => [episode.episodeId, episode]));
  const grouped = groupLibrary(records ?? []);

  return (
    <>
      <SiteHeader current="library" />
      <div className="pad">
        <h1>Your library</h1>
        <p className="meta">Stored in this browser. Not an account.</p>
        {records === null || isLibraryEmpty(grouped) ? (
          <p className="note">
            Nothing in progress. You have not saved an episode. Open a show from Discover.
          </p>
        ) : (
          <LibraryList
            continue={grouped.continue.flatMap((record) => {
              const episode = lookup.get(record.episodeId);
              if (!episode) return [];
              return [{ ...episode, meta: formatContinueMeta(record.positionSeconds) }];
            })}
            history={grouped.history.flatMap((record) => {
              const episode = lookup.get(record.episodeId);
              if (!episode) return [];
              return [{ ...episode, meta: "Finished" }];
            })}
            saved={grouped.saved.flatMap((record) => {
              const episode = lookup.get(record.episodeId);
              if (!episode) return [];
              return [{ ...episode, meta: "Saved" }];
            })}
          />
        )}
      </div>
    </>
  );
}
