import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { ensureCatalogSchema, loadIngestRules, loadSeedCatalog, seedCatalog } from "../catalog-db.ts";
import { createCatalogPool } from "../pg.ts";
import { catalogSchemaName } from "../schema.ts";
import { createYoutubeClient } from "../youtube/client.ts";
import { runIngestPg } from "./run-pg.ts";
import { runIngest, type IngestStats } from "./run.ts";

export function catalogDbPath(): string {
  const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? join(process.cwd(), "data");
  return join(dataDir, "panel-club-catalog.sqlite");
}

/** Prefer direct Neon host; pooler URLs can stall long ingest transactions. */
export function directCatalogDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("-pooler.")) {
      parsed.hostname = parsed.hostname.replace("-pooler.", ".");
    }
    return parsed.toString();
  } catch {
    return url.replace("-pooler.", ".");
  }
}

export function ingestUsesPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function openFileCatalogDb(): DatabaseSync {
  const dbPath = catalogDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  ensureCatalogSchema(db);
  seedCatalog(db, loadSeedCatalog(), loadIngestRules());
  return db;
}

export type IngestCliResult = IngestStats & {
  schema: string;
  db?: string;
  backend: "postgres" | "sqlite";
};

export async function runIngestCli(): Promise<IngestCliResult> {
  const schema = catalogSchemaName();
  const youtube = createYoutubeClient({
    fetch: globalThis.fetch,
    apiKey: process.env.YOUTUBE_API_KEY,
  });

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const pool = createCatalogPool(directCatalogDatabaseUrl(databaseUrl));
    try {
      const stats = await runIngestPg(pool, youtube);
      return { schema, backend: "postgres", ...stats };
    } finally {
      await pool.end();
    }
  }

  const db = openFileCatalogDb();
  try {
    const stats = await runIngest(db, youtube);
    return { schema, backend: "sqlite", db: catalogDbPath(), ...stats };
  } finally {
    db.close();
  }
}

const isMain = process.argv[1]?.includes("ingest/cli.ts");

if (isMain) {
  const result = await runIngestCli();
  console.log(JSON.stringify(result, null, 2));
}
