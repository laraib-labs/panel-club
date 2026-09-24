import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  catalogToView,
  hasEpisode,
  loadIngestRules,
  loadSeedCatalog,
  openMemoryCatalogDb,
  seedCatalog,
} from "./catalog-db.ts";
import { decideVideo, deriveEpisodeFields, runIngest } from "./ingest/run.ts";
import type { YoutubeClient } from "./youtube/client.ts";

describe("catalog seed", () => {
  it("creates the nine locked tables", () => {
    const db = openMemoryCatalogDb();
    const rows = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as Array<{ name: string }>;
    assert.deepEqual(
      rows.map((row) => row.name),
      [
        "episode_credits",
        "episodes",
        "ingest_items",
        "ingest_runs",
        "people",
        "reviews",
        "schema_migrations",
        "show_credits",
        "shows",
        "sources",
      ],
    );
  });

  it("seeds 16 shows, series hosts, and guest credits", () => {
    const db = openMemoryCatalogDb();
    seedCatalog(db, loadSeedCatalog(), loadIngestRules());
    const view = catalogToView(db);
    assert.equal(view.shows.length, 16);
    const latent = view.shows.find((show) => show.name === "India's Got Latent");
    assert.ok(latent);
    assert.equal(latent.host, "Samay Raina");
    assert.equal(latent.episodes.length, 7);
    assert.equal(hasEpisode(db, "eHTXQW58WhA"), true);

    const hosts = db.prepare(
      "SELECT person_slug FROM show_credits WHERE show_slug = ? AND role = 'host'",
    ).all("indias-got-latent") as Array<{ person_slug: string }>;
    assert.deepEqual(hosts.map((row) => row.person_slug), ["samay-raina"]);

    const guests = db.prepare(
      "SELECT person_slug FROM episode_credits WHERE episode_id = ? AND role = 'guest' ORDER BY person_slug",
    ).all("eHTXQW58WhA") as Array<{ person_slug: string }>;
    assert.deepEqual(guests.map((row) => row.person_slug), [
      "alia-bhatt",
      "ashish-solanki",
      "sharvari",
    ]);

    const dualHosts = db.prepare(
      "SELECT person_slug FROM show_credits WHERE show_slug = ? AND role = 'host' ORDER BY person_slug",
    ).all("andha-pyaar") as Array<{ person_slug: string }>;
    assert.deepEqual(dualHosts.map((row) => row.person_slug), [
      "kaustubh-agarwal",
      "vivek-samtani",
    ]);
  });
});

describe("runIngest", () => {
  it("inserts a new matching video, upserts existing rows, and skips chess uploads", async () => {
    const db = openMemoryCatalogDb();
    seedCatalog(db, loadSeedCatalog(), loadIngestRules());

    const youtube: YoutubeClient = {
      async listLatest(source) {
        if (source.handle === "SamayRainaOfficial") {
          return [
            {
              videoId: "eHTXQW58WhA",
              title: "INDIA’S GOT LATENT S2 EP1 ft. Alia Bhatt",
              publishedAt: "2026-01-01T00:00:00Z",
              durationSeconds: 3561,
            },
            {
              videoId: "brandNewLatent",
              title: "INDIA’S GOT LATENT S2 EP8 ft. Fresh Guest",
              publishedAt: "2026-09-24T00:00:00Z",
              durationSeconds: 3200,
            },
            {
              videoId: "chessStream",
              title: "Late night chess",
              publishedAt: "2026-09-24T00:00:00Z",
              durationSeconds: 8000,
            },
          ];
        }

        return [];
      },
    };

    const first = await runIngest(db, youtube);
    assert.equal(first.inserted, 1);
    assert.equal(first.updated, 1);
    assert.equal(hasEpisode(db, "brandNewLatent"), true);

    const view = catalogToView(db);
    const latent = view.shows.find((show) => show.name === "India's Got Latent");
    assert.equal(latent?.episodes.length, 8);
    const fresh = latent?.episodes.find((episode) => episode.videoId === "brandNewLatent");
    assert.equal(fresh?.guest, "Fresh Guest");
    assert.equal(latent?.coverVideoId, "brandNewLatent");

    const second = await runIngest(db, youtube);
    assert.equal(second.inserted, 0);
    assert.equal(second.updated, 2);
  });

  it("updates title on the same youtube id", async () => {
    const db = openMemoryCatalogDb();
    seedCatalog(db, loadSeedCatalog(), loadIngestRules());

    let title = "INDIA’S GOT LATENT S2 EP8 ft. Fresh Guest";
    const youtube: YoutubeClient = {
      async listLatest(source) {
        if (source.handle === "SamayRainaOfficial") {
          return [
            {
              videoId: "brandNewLatent",
              title,
              publishedAt: "2026-09-24T00:00:00Z",
              durationSeconds: 3200,
            },
          ];
        }
        return [];
      },
    };

    await runIngest(db, youtube);
    title = "INDIA’S GOT LATENT S2 EP8 ft. Renamed Guest";
    const second = await runIngest(db, youtube);
    assert.equal(second.updated, 1);

    const row = db.prepare("SELECT title FROM episodes WHERE youtube_video_id = ?").get("brandNewLatent") as {
      title: string;
    };
    assert.match(row.title, /Renamed Guest/);
  });

  it("maps premieres to upcoming and marks missing API ids unpublished", async () => {
    const db = openMemoryCatalogDb();
    seedCatalog(db, loadSeedCatalog(), loadIngestRules());

    const youtube: YoutubeClient = {
      async listLatest(source) {
        if (source.handle === "SamayRainaOfficial") {
          return [
            {
              videoId: "premiereSoon",
              title: "INDIA’S GOT LATENT S2 EP9",
              publishedAt: "2026-09-24T00:00:00Z",
              durationSeconds: 0,
              liveBroadcastContent: "upcoming",
              scheduledStartTime: "2026-10-04T18:00:00Z",
            },
            {
              videoId: "gonePrivate",
              title: "INDIA’S GOT LATENT removed",
              publishedAt: "2026-08-01T00:00:00Z",
              durationSeconds: 3000,
              missingFromApi: true,
            },
          ];
        }
        return [];
      },
    };

    const stats = await runIngest(db, youtube);
    assert.equal(stats.inserted, 2);
    assert.equal(stats.unpublished, 1);

    const premiere = db.prepare(
      "SELECT status, premieres_at, unpublished FROM episodes WHERE youtube_video_id = ?",
    ).get("premiereSoon") as { status: string; premieres_at: string; unpublished: number };
    assert.equal(premiere.status, "upcoming");
    assert.equal(premiere.premieres_at, "2026-10-04");
    assert.equal(premiere.unpublished, 0);

    const removed = db.prepare("SELECT unpublished FROM episodes WHERE youtube_video_id = ?").get("gonePrivate") as {
      unpublished: number;
    };
    assert.equal(removed.unpublished, 1);
  });

  it("derives upcoming from future scheduled start times", () => {
    const fields = deriveEpisodeFields({
      videoId: "x",
      title: "LATENT",
      publishedAt: null,
      durationSeconds: null,
      scheduledStartTime: "2099-01-01T12:00:00Z",
    });
    assert.equal(fields.status, "upcoming");
    assert.equal(fields.premieresAt, "2099-01-01");
  });

  it("rejects channel videos under the duration floor", () => {
    const decision = decideVideo(
      {
        showId: "indias-got-latent",
        kind: "channel",
        playlistId: null,
        channelId: null,
        handle: "SamayRainaOfficial",
        titleInclude: "LATENT",
        minDurationSeconds: 600,
      },
      {
        videoId: "clip",
        title: "LATENT clip",
        publishedAt: null,
        durationSeconds: 45,
      },
      false,
    );
    assert.equal(decision.status, "skipped");
    assert.equal(decision.detail, "minDuration");
  });
});
