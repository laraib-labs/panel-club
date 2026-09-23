import { LibraryList, type LibraryEpisodeItem } from "../../components/library-list.tsx";
import type { LibraryRecord } from "../../lib/library.ts";
import { groupLibrary, isLibraryEmpty } from "../../lib/library-view.ts";

export type LibraryPageProps = {
  records: LibraryRecord[];
  resolveEpisode: (episodeId: string) => { title: string; href: string } | null;
};

function formatContinueMeta(positionSeconds: number): string {
  const minutes = Math.floor(positionSeconds / 60);
  return `${minutes} min in · not finished`;
}

function toEpisodeItems(
  records: LibraryRecord[],
  resolveEpisode: LibraryPageProps["resolveEpisode"],
  metaFor: (record: LibraryRecord) => string,
): LibraryEpisodeItem[] {
  const items: LibraryEpisodeItem[] = [];

  for (const record of records) {
    const episode = resolveEpisode(record.episodeId);
    if (!episode) {
      continue;
    }

    items.push({
      episodeId: record.episodeId,
      title: episode.title,
      href: episode.href,
      meta: metaFor(record),
    });
  }

  return items;
}

export function LibraryPage({ records, resolveEpisode }: LibraryPageProps) {
  const grouped = groupLibrary(records);

  if (isLibraryEmpty(grouped)) {
    return (
      <div className="pad">
        <h3>Your library</h3>
        <p className="empty note">
          Nothing in progress. You have not saved an episode. Open a show from Discover.
        </p>
        <p>
          <a href="/">Discover shows</a>
        </p>
      </div>
    );
  }

  return (
    <LibraryList
      continue={toEpisodeItems(grouped.continue, resolveEpisode, (record) =>
        formatContinueMeta(record.positionSeconds),
      )}
      history={toEpisodeItems(grouped.history, resolveEpisode, () => "Finished")}
      saved={toEpisodeItems(grouped.saved, resolveEpisode, () => "Saved")}
    />
  );
}

export default LibraryPage;
