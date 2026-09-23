import type { LibraryRecord } from "./library.ts";

export type GroupedLibrary = {
  continue: LibraryRecord[];
  history: LibraryRecord[];
  saved: LibraryRecord[];
};

function byRecentWatch(a: LibraryRecord, b: LibraryRecord): number {
  const aTime = a.lastWatchedAt ?? "";
  const bTime = b.lastWatchedAt ?? "";
  return bTime.localeCompare(aTime);
}

export function groupLibrary(records: LibraryRecord[]): GroupedLibrary {
  const continueWatching: LibraryRecord[] = [];
  const history: LibraryRecord[] = [];
  const saved: LibraryRecord[] = [];

  for (const record of records) {
    if (record.saved) {
      saved.push(record);
    }

    if (record.finished) {
      history.push(record);
    } else if (record.positionSeconds > 0) {
      continueWatching.push(record);
    }
  }

  continueWatching.sort(byRecentWatch);
  history.sort(byRecentWatch);
  saved.sort(byRecentWatch);

  return {
    continue: continueWatching,
    history,
    saved,
  };
}

export function isLibraryEmpty(grouped: GroupedLibrary): boolean {
  return (
    grouped.continue.length === 0 &&
    grouped.history.length === 0 &&
    grouped.saved.length === 0
  );
}
