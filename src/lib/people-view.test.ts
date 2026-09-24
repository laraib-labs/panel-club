import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterPeople, personMonogram, type Person } from "./people-view.ts";

const samplePeople: Person[] = [
  { name: "Alice Host", slug: "alice-host" },
  { name: "Bob Host", slug: "bob-host" },
  { name: "Charlie Guest", slug: "charlie-guest" },
];

describe("personMonogram", () => {
  it("uses first and last name initials for multi-word names", () => {
    assert.equal(personMonogram("Kaustubh Agarwal"), "KA");
    assert.equal(personMonogram("Samay Raina"), "SR");
    assert.equal(personMonogram("Gaurav Kapoor"), "GK");
  });

  it("uses the first two letters for a single-word name", () => {
    assert.equal(personMonogram("Madonna"), "MA");
  });

  it("uppercases the result", () => {
    assert.equal(personMonogram("alice host"), "AH");
  });
});

describe("filterPeople", () => {
  it("returns everyone when the query is blank", () => {
    assert.deepEqual(filterPeople(samplePeople, ""), samplePeople);
    assert.deepEqual(filterPeople(samplePeople, "   "), samplePeople);
  });

  it("matches names case-insensitively", () => {
    assert.deepEqual(
      filterPeople(samplePeople, "alice").map((person) => person.name),
      ["Alice Host"],
    );
  });
});
