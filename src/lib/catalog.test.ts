import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getEpisode, getShow, loadCatalog, slugFromName } from "./catalog.ts";

const ALLOWED_CATEGORIES = [
  "Panel shows",
  "Game shows",
  "Roasts",
  "Advice & banter",
];

describe("catalog", () => {
  it("loads 16 shows with only the four directory categories", () => {
    const catalog = loadCatalog();

    assert.equal(catalog.shows.length, 16);

    const categories = [...new Set(catalog.shows.map((show) => show.category))].sort();
    assert.deepEqual(categories, [...ALLOWED_CATEGORIES].sort());
  });

  it("lists seven aired episodes for India's Got Latent", () => {
    const catalog = loadCatalog();
    const show = getShow(catalog, slugFromName("India's Got Latent"));

    assert.ok(show);
    assert.equal(show.episodes.length, 7);
    assert.ok(show.episodes.every((episode) => episode.status === "aired"));
    assert.ok(show.episodes.every((episode) => episode.mediaUrl === null));
  });

  it("gives every episode a non-empty YouTube videoId", () => {
    const catalog = loadCatalog();

    for (const show of catalog.shows) {
      for (const episode of show.episodes) {
        assert.ok(episode.videoId.length > 0, `${show.name}: ${episode.title}`);
      }
    }
  });

  it("resolves shows and episodes by slug and videoId", () => {
    const catalog = loadCatalog();
    const show = getShow(catalog, "indias-got-latent");

    assert.ok(show);
    assert.equal(show.name, "India's Got Latent");

    const episode = getEpisode(show, "eHTXQW58WhA");
    assert.ok(episode);
    assert.equal(episode.title, show.episodes[0].title);
  });
});
