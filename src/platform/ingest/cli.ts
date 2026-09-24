import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { ensureCatalogSchema, loadIngestRules, loadSeedCatalog, seedCatalog } from "../catalog-db.ts";
import { catalogSchemaName } from "../schema.ts";
import { createYoutubeClient } from "../youtube/client.ts";
import { runIngest } from "./run.ts";

function catalogDbPath(): string {
  const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? join(process.cwd(), "data");
  return join(dataDir, "panel-club-catalog.sqlite");
}

function openFileCatalogDb(): DatabaseSync {
  const dbPath = catalogDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  ensureCatalogSchema(db);
  seedCatalog(db, loadSeedCatalog(), loadIngestRules());
  return db;
}

const db = openFileCatalogDb();
const youtube = createYoutubeClient({
  fetch: globalThis.fetch,
  apiKey: process.env.YOUTUBE_API_KEY,
});

const stats = await runIngest(db, youtube);
console.log(
  JSON.stringify(
    {
      schema: catalogSchemaName(),
      db: catalogDbPath(),
      ...stats,
    },
    null,
    2,
  ),
);
db.close();
