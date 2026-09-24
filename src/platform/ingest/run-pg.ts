import type pg from "pg";

import type { CatalogSource } from "../catalog-db.ts";
import {
  finishIngestRunPg,
  listActiveSourcesPg,
  recordIngestItemPg,
  refreshShowCoverVideoPg,
  startIngestRunPg,
  upsertEpisodePg,
} from "../catalog-ingest-pg.ts";
import type { YoutubeClient, YoutubeVideo } from "../youtube/client.ts";
import { parseCredits } from "../youtube/title-credits.ts";
import { decideVideo, deriveEpisodeFields, type IngestStats } from "./run.ts";

export type PgIngestDeps = {
  listActiveSources: () => Promise<CatalogSource[]>;
  startIngestRun: () => Promise<string>;
  finishIngestRun: (
    runId: string,
    stats: { inserted: number; skipped: number; updated: number; unpublished: number; errors: number },
  ) => Promise<void>;
  recordIngestItem: (
    runId: string,
    item: { videoId: string; showId: string; status: string; detail: string },
  ) => Promise<void>;
  upsertEpisode: (episode: {
    videoId: string;
    showId: string;
    title: string;
    guest: string;
    durationSeconds: number;
    publishedAt: string | null;
    status: "aired" | "upcoming";
    unpublished: number;
    premieresAt: string | null;
  }) => Promise<"inserted" | "updated">;
  refreshShowCoverVideo: (showId: string) => Promise<void>;
};

export function createPgIngestDeps(pool: pg.Pool): PgIngestDeps {
  return {
    listActiveSources: () => listActiveSourcesPg(pool),
    startIngestRun: () => startIngestRunPg(pool),
    finishIngestRun: (runId, stats) => finishIngestRunPg(pool, runId, stats),
    recordIngestItem: (runId, item) => recordIngestItemPg(pool, runId, item),
    upsertEpisode: (episode) => upsertEpisodePg(pool, episode),
    refreshShowCoverVideo: (showId) => refreshShowCoverVideoPg(pool, showId),
  };
}

export async function runIngestPg(
  pool: pg.Pool,
  youtube: YoutubeClient,
  deps?: PgIngestDeps,
): Promise<IngestStats> {
  const d = deps ?? createPgIngestDeps(pool);
  const runId = await d.startIngestRun();
  const stats = { inserted: 0, updated: 0, skipped: 0, unpublished: 0, errors: 0 };
  const sources = await d.listActiveSources();

  for (const source of sources) {
    let videos: YoutubeVideo[];
    try {
      videos = await youtube.listLatest(source);
    } catch (error) {
      stats.errors += 1;
      await d.recordIngestItem(runId, {
        videoId: `source:${source.showId}`,
        showId: source.showId,
        status: "error",
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const video of videos) {
      const decision = decideVideo(source, video);
      await d.recordIngestItem(runId, {
        videoId: video.videoId,
        showId: source.showId,
        status: decision.status,
        detail: decision.detail,
      });

      if (decision.status === "ingested") {
        const fields = deriveEpisodeFields(video);
        const outcome = await d.upsertEpisode({
          videoId: video.videoId,
          showId: source.showId,
          title: video.title,
          guest: parseCredits(video.title, video.description),
          durationSeconds: video.durationSeconds ?? 0,
          publishedAt: video.publishedAt,
          status: fields.status,
          unpublished: fields.unpublished,
          premieresAt: fields.premieresAt,
        });

        if (outcome === "inserted") {
          stats.inserted += 1;
        } else {
          stats.updated += 1;
        }

        if (fields.unpublished === 1) {
          stats.unpublished += 1;
        }
        continue;
      }

      if (decision.status === "error") {
        stats.errors += 1;
        continue;
      }

      stats.skipped += 1;
    }

    await d.refreshShowCoverVideo(source.showId);
  }

  await d.finishIngestRun(runId, stats);
  return { runId, ...stats };
}
