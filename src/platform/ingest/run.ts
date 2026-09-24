import type { DatabaseSync } from "node:sqlite";

import {
  finishIngestRun,
  listActiveSources,
  recordIngestItem,
  refreshShowCoverVideo,
  startIngestRun,
  upsertEpisode,
  type CatalogSource,
} from "../catalog-db.ts";
import type { YoutubeClient, YoutubeVideo } from "../youtube/client.ts";
import { looksLikeShort, parseCredits, titleMatchesInclude } from "../youtube/title-credits.ts";

export type IngestStats = {
  runId: string;
  inserted: number;
  updated: number;
  skipped: number;
  unpublished: number;
  errors: number;
};

export async function runIngest(db: DatabaseSync, youtube: YoutubeClient): Promise<IngestStats> {
  const runId = startIngestRun(db);
  const stats = { inserted: 0, updated: 0, skipped: 0, unpublished: 0, errors: 0 };
  const sources = listActiveSources(db);

  for (const source of sources) {
    let videos: YoutubeVideo[];
    try {
      videos = await youtube.listLatest(source);
    } catch (error) {
      stats.errors += 1;
      recordIngestItem(db, runId, {
        videoId: `source:${source.showId}`,
        showId: source.showId,
        status: "error",
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const video of videos) {
      const decision = decideVideo(source, video);
      recordIngestItem(db, runId, {
        videoId: video.videoId,
        showId: source.showId,
        status: decision.status,
        detail: decision.detail,
      });

      if (decision.status === "ingested") {
        const fields = deriveEpisodeFields(video);
        const outcome = upsertEpisode(db, {
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

    refreshShowCoverVideo(db, source.showId);
  }

  finishIngestRun(db, runId, stats);
  return { runId, ...stats };
}

export function deriveEpisodeFields(video: YoutubeVideo): {
  status: "aired" | "upcoming";
  premieresAt: string | null;
  unpublished: number;
} {
  const scheduledFuture =
    video.scheduledStartTime != null && new Date(video.scheduledStartTime).getTime() > Date.now();
  const isUpcoming = video.liveBroadcastContent === "upcoming" || scheduledFuture;
  const unpublished =
    video.missingFromApi === true || video.privacyStatus === "private" ? 1 : 0;

  let premieresAt: string | null = null;
  if (isUpcoming && video.scheduledStartTime) {
    premieresAt = video.scheduledStartTime.slice(0, 10);
  }

  return {
    status: isUpcoming ? "upcoming" : "aired",
    premieresAt,
    unpublished,
  };
}

export function decideVideo(
  source: CatalogSource,
  video: YoutubeVideo,
): { status: "ingested" | "skipped" | "error"; detail: string } {
  if (source.kind === "channel" && !source.titleInclude) {
    return { status: "skipped", detail: "channel source missing titleInclude" };
  }

  if (!titleMatchesInclude(video.title, source.titleInclude)) {
    return { status: "skipped", detail: "titleInclude" };
  }

  if (looksLikeShort(video.title)) {
    return { status: "skipped", detail: "short" };
  }

  if (
    video.durationSeconds != null &&
    video.durationSeconds > 0 &&
    video.durationSeconds < source.minDurationSeconds
  ) {
    return { status: "skipped", detail: "minDuration" };
  }

  return { status: "ingested", detail: "" };
}
