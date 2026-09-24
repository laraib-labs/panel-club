import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { ensureCatalogSchema, loadIngestRules, loadSeedCatalog, seedCatalog } from "../catalog-db.ts";
import { createCatalogPool } from "../pg.ts";
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
  db?: string;
  backend: "postgres" | "sqlite";
};

export async function runIngestCli(): Promise<IngestCliResult> {
  const youtube = createYoutubeClient({
    fetch: globalThis.fetch,
    apiKey: process.env.YOUTUBE_API_KEY,
  });

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const pool = createCatalogPool(directCatalogDatabaseUrl(databaseUrl));
    try {
      const stats = await runIngestPg(pool, youtube);
      return { backend: "postgres", ...stats };
    } finally {
      await pool.end();
    }
  }

  const db = openFileCatalogDb();
  try {
    const stats = await runIngest(db, youtube);
    return { backend: "sqlite", db: catalogDbPath(), ...stats };
  } finally {
    db.close();
  }
}



export function healthcheckBaseUrl(): string | null {
  const raw = process.env.HEALTHCHECKS_URL ?? process.env.HEALTHCHECK_URL;
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.replace(/\/$/, "") : null;
}

function healthcheckUrl(suffix: "" | "/start" | "/fail", base: string): string {
  return suffix ? `${base}${suffix}` : base;
}

export async function pingHealthcheck(
  phase: "start" | "success" | "fail",
  detail?: string,
): Promise<void> {
  const base = healthcheckBaseUrl();
  if (!base) {
    return;
  }

  const url =
    phase === "start"
      ? healthcheckUrl("/start", base)
      : phase === "fail"
        ? healthcheckUrl("/fail", base)
        : healthcheckUrl("", base);

  try {
    if (phase === "fail") {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: detail?.slice(0, 8000) ?? "ingest failed",
      });
      return;
    }
    await fetch(url, { method: "GET" });
  } catch (error) {
    console.error(
      `healthcheck ${phase} ping failed:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}


const isMain = process.argv[1]?.includes("ingest/cli.ts");

if (isMain) {
  await pingHealthcheck("start");
  try {
    const result = await runIngestCli();
    await pingHealthcheck("success");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
    await pingHealthcheck("fail", detail);
    throw error;
  }
}
