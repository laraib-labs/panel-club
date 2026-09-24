import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { loadIngestRules, loadSeedCatalog, seedCatalog } from "./catalog-db.ts";
import { applySqliteCatalogSchema } from "./migrate.ts";

export { seedCatalog };

export function seedSqliteFile(dbPath: string): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    applySqliteCatalogSchema(db);
    seedCatalog(db, loadSeedCatalog(), loadIngestRules());
  } finally {
    db.close();
  }
}

const isMain = process.argv[1]?.includes("seed.ts");

if (isMain) {
  if (process.env.DATABASE_URL) {
    throw new Error("Postgres seed is not in this slice; set no DATABASE_URL and pass a sqlite path");
  }

  const dbPath = join(process.cwd(), "data", "panel-club-catalog.sqlite");
  seedSqliteFile(dbPath);
  console.log(JSON.stringify({ db: dbPath, seeded: true }));
}
