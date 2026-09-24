import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { SQLITE_CATALOG_DDL } from "./schema.ts";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../docs/sql/migrations");
const SQLITE_MIGRATION_ID = "001_init";


export function listMigrationIds(dir = migrationsDir): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.replace(/\.sql$/, ""))
    .sort();
}

export function applySqliteCatalogSchema(db: DatabaseSync): string[] {
  db.exec(SQLITE_CATALOG_DDL);

  const existing = db.prepare("SELECT 1 AS ok FROM schema_migrations WHERE id = ?").get(SQLITE_MIGRATION_ID) as
    | { ok: number }
    | undefined;
  if (existing) {
    return [];
  }

  db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(
    SQLITE_MIGRATION_ID,
    new Date().toISOString(),
  );
  return [SQLITE_MIGRATION_ID];
}

export type SqlQuery = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Array<Record<string, unknown>> }>;


export async function migratePostgres(query: SqlQuery): Promise<string[]> {
  const applied: string[] = [];
  for (const id of listMigrationIds()) {
    if (await migrationRecorded(query, id)) {
      continue;
    }

    const sql = readFileSync(join(migrationsDir, `${id}.sql`), "utf8");
    await query(sql);
    await query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, NOW()) ON CONFLICT (id) DO NOTHING", [id]);
    applied.push(id);
  }

  return applied;
}

async function migrationRecorded(query: SqlQuery, id: string): Promise<boolean> {
  try {
    const result = await query("SELECT 1 AS ok FROM schema_migrations WHERE id = $1", [id]);
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to migrate Postgres");
  }

  const pg = await import("pg");
  const Pool = pg.Pool ?? pg.default.Pool;
  const pool = new Pool({ connectionString: url });
  try {
    const applied = await migratePostgres((sql, params) => pool.query(sql, params));
    console.log(JSON.stringify({ applied }));
  } finally {
    await pool.end();
  }
}
