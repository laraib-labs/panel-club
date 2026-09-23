import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Catalog } from "./catalog.ts";
import { loadCatalog, slugFromName } from "./catalog.ts";
import { appearances, listPeople } from "./people.ts";

const fixtureCatalog: Catalog = {
  shows: [
    {
      name: "Co-Host Show",
      host: "Alice Host & Bob Host",
      category: "Panel shows",
      description: "",
      coverVideoId: "cover1",
      sourceUrl: "https://example.com",
      checkedAt: "2026-01-01",
      availabilityNote: "",
      episodes: [
        {
          title: "Alice guests here",
          videoId: "guest-ep",
          guest: "Alice Host, Charlie Guest",
          duration: 100,
          status: "aired",
          mediaUrl: null,
        },
        {
          title: "Featuring Imaginary Person",
          videoId: "empty-guest-ep",
          guest: "",
          duration: 200,
          status: "aired",
          mediaUrl: null,
        },
      ],
    },
    {
      name: "Solo Host Show",
      host: "Charlie Guest",
      category: "Game shows",
      description: "",
      coverVideoId: "cover2",
      sourceUrl: "https://example.com",
      checkedAt: "2026-01-01",
      availabilityNote: "",
      episodes: [
        {
          title: "No guests listed",
          videoId: "solo-ep",
          guest: "",
          duration: 300,
          status: "aired",
          mediaUrl: null,
        },
      ],
    },
  ],
};

describe("people", () => {
  it("does not invent a person from an empty guest string", () => {
    const people = listPeople(fixtureCatalog);
    const names = people.map((person) => person.name);

    assert.ok(!names.includes("Featuring Imaginary Person"));
    assert.ok(!names.includes("Imaginary Person"));
    assert.equal(names.length, 3);
  });

  it("lists a name once when they are both host and guest", () => {
    const people = listPeople(fixtureCatalog);
    const aliceMatches = people.filter((person) => person.name === "Alice Host");

    assert.equal(aliceMatches.length, 1);
    assert.equal(aliceMatches[0]?.slug, slugFromName("Alice Host"));
  });

  it("splits co-hosts on ampersand boundaries", () => {
    const people = listPeople(fixtureCatalog);
    const names = people.map((person) => person.name).sort();

    assert.deepEqual(names, ["Alice Host", "Bob Host", "Charlie Guest"]);
  });

  it("lists host episodes and guest episodes in appearances", () => {
    const alice = appearances(fixtureCatalog, slugFromName("Alice Host"));

    assert.ok(alice);
    assert.equal(alice.name, "Alice Host");
    assert.equal(alice.hosted.length, 2);
    assert.deepEqual(
      alice.hosted.map((row) => row.episode.videoId).sort(),
      ["empty-guest-ep", "guest-ep"],
    );
    assert.equal(alice.guested.length, 1);
    assert.equal(alice.guested[0]?.episode.videoId, "guest-ep");
  });

  it("loads people from the seeded catalog", () => {
    const catalog = loadCatalog();
    const people = listPeople(catalog);

    assert.ok(people.length > 0);
    assert.ok(people.every((person) => person.slug === slugFromName(person.name)));
    assert.ok(
      people.every(
        (person, index, list) => list.findIndex((entry) => entry.slug === person.slug) === index,
      ),
    );
  });
});
