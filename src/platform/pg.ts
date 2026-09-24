import pg from "pg";

import { catalogSchemaName } from "./schema.ts";

function assertSafeSchemaName(name: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(`unsafe schema name: ${name}`);
  }

  return name;
}

export function createCatalogPool(connectionString: string): pg.Pool {
  const schema = assertSafeSchemaName(catalogSchemaName());
  return new pg.Pool({
    connectionString,
    onConnect: async (client) => {
      await client.query(`SET search_path TO ${schema}, public`);
    },
  });
}
