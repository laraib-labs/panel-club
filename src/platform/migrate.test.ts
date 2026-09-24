import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import {
  applySqliteCatalogSchema,
  listMigrationIds,
} from "./migrate.ts";
import { catalogSchemaName } from "./schema.ts";

const LOCKED_TABLES = [
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
];

describe("catalogSchemaName", () => {
  it("defaults to panel_club_test outside production", () => {
    const previous = process.env.CATALOG_SCHEMA;
    delete process.env.CATALOG_SCHEMA;
    try {
      assert.notEqual(process.env.NODE_ENV, "production");
      assert.equal(catalogSchemaName(), "panel_club_test");
    } finally {
      if (previous === undefined) {
        delete process.env.CATALOG_SCHEMA;
      } else {
        process.env.CATALOG_SCHEMA = previous;
      }
    }
  });

  it("honors CATALOG_SCHEMA", () => {
    const previous = process.env.CATALOG_SCHEMA;
    process.env.CATALOG_SCHEMA = "panel_club";
    try {
      assert.equal(catalogSchemaName(), "panel_club");
    } finally {
      if (previous === undefined) {
        delete process.env.CATALOG_SCHEMA;
      } else {
        process.env.CATALOG_SCHEMA = previous;
      }
    }
  });
});

describe("migrations", () => {
  it("lists numbered SQL migrations including 001_init", () => {
    const ids = listMigrationIds();
    assert.ok(ids.includes("001_init"));
    assert.deepEqual(ids, [...ids].sort());
  });

  it("applies the sqlite mirror: nine catalog tables plus schema_migrations", () => {
    const db = new DatabaseSync(":memory:");
    const applied = applySqliteCatalogSchema(db);
    assert.deepEqual(applied, ["001_init"]);

    const tables = db
      .prepare(
        `
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `,
      )
      .all() as Array<{ name: string }>;
    assert.deepEqual(
      tables.map((row) => row.name),
      LOCKED_TABLES,
    );

    const again = applySqliteCatalogSchema(db);
    assert.deepEqual(again, []);
    const count = db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get() as { n: number };
    assert.equal(count.n, 1);
    db.close();
  });
});
