import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Catalog, Show } from "./catalog.ts";
import { loadCatalog } from "./catalog.ts";
import { splitSchedule } from "./schedule.ts";

function makeShow(episodes: Show["episodes"]): Show {
  return {
    name: "Fixture Show",
    host: "Fixture Host",
    category: "Panel shows",
    description: "",
    coverVideoId: "fixture-cover",
    sourceUrl: "https://example.com",
    checkedAt: "2026-09-23",
    availabilityNote: "",
    episodes,
  };
}

describe("splitSchedule", () => {
  it("returns no upcoming rows for the seeded catalog", () => {
    const { upcoming, aired } = splitSchedule(loadCatalog());

    assert.equal(upcoming.length, 0);
    assert.ok(aired.length > 0);
    assert.ok(aired.every((entry) => entry.episodeCount > 0));
  });

  it("puts dated upcoming episodes before undated ones", () => {
    const catalog: Catalog = {
      shows: [
        makeShow([
          {
            title: "Undated taping",
            videoId: "fixture-undated",
            guest: "",
            duration: 3600,
            status: "upcoming",
            mediaUrl: null,
          },
          {
            title: "Dated premiere",
            videoId: "fixture-dated",
            guest: "",
            duration: 3600,
            status: "upcoming",
            premieresAt: "2026-10-04",
            mediaUrl: null,
          },
        ]),
      ],
    };

    const { upcoming } = splitSchedule(catalog);

    assert.equal(upcoming.length, 2);
    assert.equal(upcoming[0].episode.videoId, "fixture-dated");
    assert.equal(upcoming[1].episode.videoId, "fixture-undated");
  });

  it("keeps aired episodes in the archive and out of upcoming", () => {
    const catalog: Catalog = {
      shows: [
        makeShow([
          {
            title: "Already out",
            videoId: "fixture-aired",
            guest: "",
            duration: 3600,
            status: "aired",
            mediaUrl: null,
          },
          {
            title: "Still coming",
            videoId: "fixture-upcoming",
            guest: "",
            duration: 3600,
            status: "upcoming",
            premieresAt: "2026-11-01",
            mediaUrl: null,
          },
        ]),
      ],
    };

    const { upcoming, aired } = splitSchedule(catalog);

    assert.equal(upcoming.length, 1);
    assert.equal(upcoming[0].episode.videoId, "fixture-upcoming");
    assert.equal(aired.length, 1);
    assert.equal(aired[0].episodeCount, 1);
    assert.equal(aired[0].show.name, "Fixture Show");
  });
});
