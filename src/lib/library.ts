const STORAGE_KEY = "panel-club-library";

export type LibraryStorage = {
  get(key: string): string | null | undefined;
  set(key: string, value: string): void;
};

export type LibraryRecord = {
  episodeId: string;
  positionSeconds: number;
  finished: boolean;
  saved: boolean;
  lastWatchedAt: string | null;
};

type LibraryData = Record<string, LibraryRecord>;

function readLibrary(storage: LibraryStorage): LibraryData {
  const raw = storage.get(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as LibraryData;
}

function writeLibrary(storage: LibraryStorage, data: LibraryData): void {
  storage.set(STORAGE_KEY, JSON.stringify(data));
}

function defaultRecord(episodeId: string): LibraryRecord {
  return {
    episodeId,
    positionSeconds: 0,
    finished: false,
    saved: false,
    lastWatchedAt: null,
  };
}

export function recordWatch(
  storage: LibraryStorage,
  episodeId: string,
  positionSeconds: number,
): void {
  const data = readLibrary(storage);
  const existing = data[episodeId] ?? defaultRecord(episodeId);

  data[episodeId] = {
    ...existing,
    episodeId,
    positionSeconds,
    finished: false,
    lastWatchedAt: new Date().toISOString(),
  };

  writeLibrary(storage, data);
}

export function markFinished(storage: LibraryStorage, episodeId: string): void {
  const data = readLibrary(storage);
  const existing = data[episodeId] ?? defaultRecord(episodeId);

  data[episodeId] = {
    ...existing,
    episodeId,
    finished: true,
    lastWatchedAt: existing.lastWatchedAt ?? new Date().toISOString(),
  };

  writeLibrary(storage, data);
}

export function toggleSave(storage: LibraryStorage, episodeId: string): boolean {
  const data = readLibrary(storage);
  const existing = data[episodeId] ?? defaultRecord(episodeId);
  const saved = !existing.saved;

  data[episodeId] = {
    ...existing,
    episodeId,
    saved,
  };

  writeLibrary(storage, data);
  return saved;
}

export function listLibrary(storage: LibraryStorage): LibraryRecord[] {
  const data = readLibrary(storage);
  return Object.values(data);
}

export function createBrowserStorage(): LibraryStorage {
  return {
    get(key: string) {
      return localStorage.getItem(key);
    },
    set(key: string, value: string) {
      localStorage.setItem(key, value);
    },
  };
}
