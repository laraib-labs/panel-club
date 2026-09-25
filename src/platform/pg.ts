import pg from "pg";

export function createCatalogPool(connectionString: string): pg.Pool {
  // The existing Neon databases keep application tables in panel_club.
  // Set this on every app/ingest pool so query behavior does not depend on the
  // database URL's startup options or Vercel's default search_path.
  return new pg.Pool({ connectionString, options: "-c search_path=panel_club,public" });
}
