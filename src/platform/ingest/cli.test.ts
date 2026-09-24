import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  finishIngestRun,
  hasEpisode,
  listActiveSources,
  loadIngestRules,
  loadSeedCatalog,
  openMemoryCatalogDb,
  recordIngestItem,
  refreshShowCoverVideo,
  seedCatalog,
  startIngestRun,
  upsertEpisode,
} from "../catalog-db.ts";
import { REFRESH_SHOW_COVER_VIDEO_SQL } from "../catalog-ingest-pg.ts";
import { directCatalogDatabaseUrl, ingestUsesPostgres } from "./cli.ts";
import { createPgIngestDeps, runIngestPg, type PgIngestDeps } from "./run-pg.ts";
import type { YoutubeClient } from "../youtube/client.ts";

describe("ingest cli", () => {
  it("strips -pooler. from Neon hostnames", () => {
    const pooled =
      "postgresql://user:pass@ep-abc-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";
    const direct = directCatalogDatabaseUrl(pooled);
    assert.match(direct, /ep-abc-123\.us-east-2\.aws\.neon\.tech/);
    assert.doesNotMatch(direct, /-pooler\./);
  });

  it("cover refresh SQL avoids sqlite-style unpublished = 0", () => {
    assert.doesNotMatch(REFRESH_SHOW_COVER_VIDEO_SQL, /unpublished\s*=\s*0/);
    assert.match(REFRESH_SHOW_COVER_VIDEO_SQL, /unpublished IS NOT TRUE/);
  });

  it("ingestUsesPostgres follows DATABASE_URL", () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    assert.equal(ingestUsesPostgres(), false);
    process.env.DATABASE_URL = "postgres://example";
    assert.equal(ingestUsesPostgres(), true);
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
  });
});

describe("runIngestPg", () => {
  it("mirrors sqlite ingest with sqlite-backed deps", async () => {
    const db = openMemoryCatalogDb();
    seedCatalog(db, loadSeedCatalog(), loadIngestRules());

    const deps: PgIngestDeps = {
      listActiveSources: async () => listActiveSources(db),
      startIngestRun: async () => startIngestRun(db),
      finishIngestRun: async (runId, stats) => finishIngestRun(db, runId, stats),
      recordIngestItem: async (runId, item) => recordIngestItem(db, runId, item),
      upsertEpisode: async (episode) => upsertEpisode(db, episode),
      refreshShowCoverVideo: async (showId) => refreshShowCoverVideo(db, showId),
    };

    const youtube: YoutubeClient = {
      async listLatest(source) {
        if (source.handle === "SamayRainaOfficial") {
          return [
            {
              videoId: "brandNewLatent",
              title: "INDIA’S GOT LATENT S2 EP8 ft. Fresh Guest",
              publishedAt: "2026-09-24T00:00:00Z",
              durationSeconds: 3200,
            },
          ];
        }
        return [];
      },
    };

    const stats = await runIngestPg({} as import("pg").Pool, youtube, deps);
    assert.equal(stats.inserted, 1);
    assert.equal(hasEpisode(db, "brandNewLatent"), true);
  });

  it("createPgIngestDeps wires catalog-ingest-pg helpers", () => {
    const deps = createPgIngestDeps({} as import("pg").Pool);
    assert.equal(typeof deps.listActiveSources, "function");
    assert.equal(typeof deps.upsertEpisode, "function");
  });
});
