import pg from "pg";

export function createCatalogPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString });
}
