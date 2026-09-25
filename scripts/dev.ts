// Phase 0 bridge: local Postgres for `next dev` with no Docker/Homebrew install.
// Boots PGlite (embedded WASM Postgres), speaks the wire protocol on localhost,
// migrates + seeds the current schema against it, then execs `next dev` against it.
//
// Schema note (see docs/plans/ui-rebuild.md): reads in catalog.ts/reviews-pg.ts are
// already qualified as `panel_club.*`, so runtime queries don't depend on search_path.
// But 001_init.sql's CREATE TABLE statements and seed.ts's INSERT statements are
// unqualified, so DDL/seeding must run with search_path=panel_club set explicitly.
// pglite-socket doesn't honor the `options=-c search_path=...` startup parameter
// (confirmed empirically), so it's set per-session here instead: once inline for the
// DDL exec, and via an on-connect hook for the seed pool.
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";

import { loadIngestRules, loadSeedCatalog } from "../src/platform/catalog-db.ts";
import { seedPostgres } from "../src/platform/seed.ts";

const HOST = "127.0.0.1";
const PORT = 55432;
const DATA_DIR = join(process.cwd(), ".pglite-data");
const DATABASE_URL = `postgres://postgres@${HOST}:${PORT}/postgres`;
const MIGRATION_SQL = readFileSync(
  join(process.cwd(), "docs/sql/migrations/001_init.sql"),
  "utf8",
);

async function main(): Promise<void> {
  const db = await PGlite.create({ dataDir: DATA_DIR });
  // The app fires several catalog queries concurrently (Promise.all in catalog.ts);
  // pglite-socket defaults to 1 connection and resets extras, so raise the ceiling.
  const server = new PGLiteSocketServer({ db, host: HOST, port: PORT, maxConnections: 50 });
  await server.start();
  console.log(`[dev-db] PGlite listening on postgres://${HOST}:${PORT}/postgres`);

  // One exec call = one session, so this SET applies to every statement in the file.
  await db.exec(`SET search_path TO panel_club, public;\n${MIGRATION_SQL}`);
  console.log("[dev-db] schema migrated");

  const seedPool = new pg.Pool({ connectionString: DATABASE_URL });
  seedPool.on("connect", (client) => {
    client.query("SET search_path TO panel_club, public").catch((error: unknown) => {
      console.error("[dev-db] failed to set search_path on seed connection:", error);
    });
  });
  await seedPostgres(seedPool, loadSeedCatalog(), loadIngestRules());
  await seedPool.end();
  console.log("[dev-db] catalog seeded");

  const next = spawn("npx", ["next", "dev"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL },
  });

  const shutdown = async () => {
    next.kill();
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  next.on("exit", async (code) => {
    await server.stop();
    await db.close();
    process.exit(code ?? 0);
  });
}

await main();
