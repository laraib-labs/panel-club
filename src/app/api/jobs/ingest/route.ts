import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextResponse } from "next/server";

import { ensureCatalogSchema, loadIngestRules, loadSeedCatalog, seedCatalog } from "../../../../platform/catalog-db.ts";
import { createYoutubeClient } from "../../../../platform/youtube/client.ts";
import { runIngest } from "../../../../platform/ingest/run.ts";

export const runtime = "nodejs";

function catalogDbPath(): string {
  const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? join(process.cwd(), "data");
  return join(dataDir, "panel-club-catalog.sqlite");
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const dbPath = catalogDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    ensureCatalogSchema(db);
    seedCatalog(db, loadSeedCatalog(), loadIngestRules());
    const stats = await runIngest(
      db,
      createYoutubeClient({
        fetch: globalThis.fetch,
        apiKey: process.env.YOUTUBE_API_KEY,
      }),
    );
    return NextResponse.json(stats);
  } finally {
    db.close();
  }
}
