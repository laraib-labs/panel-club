import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Catalog } from "./catalog.ts";
import { filterShows } from "./filters.ts";

const fixtureCatalog: Catalog = {
  shows: [
    {
      name: "India's Got Latent",
      host: "Samay Raina",
      category: "Panel shows",
      description: "",
      coverVideoId: "cover1",
      sourceUrl: "https://example.com",
      checkedAt: "2026-01-01",
      availabilityNote: "",
      episodes: [
        {
          title: "S2 EP1 ft. Alia Bhatt",
          videoId: "ep-one",
          guest: "Alia Bhatt, Sharvari",
          duration: 3600,
          status: "aired",
          mediaUrl: null,
        },
      ],
    },
    {
      name: "Pretty Good Roast Show",
      host: "Aashish Solanki",
      category: "Roasts",
      description: "",
      coverVideoId: "cover2",
      sourceUrl: "https://example.com",
      checkedAt: "2026-01-01",
      availabilityNote: "",
      episodes: [
        {
          title: "Roast episode one",
          videoId: "ep-two",
          guest: "Aakash Gupta",
          duration: 3300,
          status: "aired",
          mediaUrl: null,
        },
      ],
    },
    {
      name: "The General Fun Game Show",
      host: "Kaneez Surka",
      category: "Game shows",
      description: "",
      coverVideoId: "cover3",
      sourceUrl: "https://example.com",
      checkedAt: "2026-01-01",
      availabilityNote: "",
      episodes: [
        {
          title: "Game night special",
          videoId: "ep-three",
          guest: "",
          duration: 2400,
          status: "aired",
          mediaUrl: null,
        },
      ],
    },
    {
      name: "Relationshit Advice",
      host: "Raunaq Rajani",
      category: "Advice & banter",
      description: "",
      coverVideoId: "cover4",
      sourceUrl: "https://example.com",
      checkedAt: "2026-01-01",
      availabilityNote: "",
      episodes: [
        {
          title: "Dating dilemmas",
          videoId: "ep-four",
          guest: "Guest Host",
          duration: 1800,
          status: "aired",
          mediaUrl: null,
        },
      ],
    },
  ],
};

describe("filterShows", () => {
  it("returns every show when query is empty and category is All shows", () => {
    const result = filterShows(fixtureCatalog, { query: "", category: "All shows" });
    assert.equal(result.length, 4);
  });

  it("filters by category", () => {
    const result = filterShows(fixtureCatalog, { query: "", category: "Roasts" });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Pretty Good Roast Show");
  });

  it("matches show name case-insensitively", () => {
    const result = filterShows(fixtureCatalog, { query: "latent", category: "All shows" });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "India's Got Latent");
  });

  it("matches host name", () => {
    const result = filterShows(fixtureCatalog, { query: "kaneez", category: "All shows" });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "The General Fun Game Show");
  });

  it("matches guest on an episode", () => {
    const result = filterShows(fixtureCatalog, { query: "alia bhatt", category: "All shows" });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "India's Got Latent");
  });

  it("matches episode title", () => {
    const result = filterShows(fixtureCatalog, { query: "game night", category: "All shows" });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "The General Fun Game Show");
  });

  it("combines category and query", () => {
    const result = filterShows(fixtureCatalog, { query: "aakash", category: "Roasts" });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Pretty Good Roast Show");
  });

  it("returns no shows when nothing matches", () => {
    const result = filterShows(fixtureCatalog, { query: "zzzz-not-found", category: "All shows" });
    assert.equal(result.length, 0);
  });
});
