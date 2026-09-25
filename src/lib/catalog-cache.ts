// Next-only: unstable_cache doesn't resolve under plain `node --test`, so this
// wrapper is kept out of catalog.ts (imported by unit tests) and used only by
// pages and the revalidate route.
import { unstable_cache } from "next/cache";

import { loadAppCatalog as loadAppCatalogUncached, type Catalog } from "./catalog.ts";

export const CATALOG_CACHE_TAG = "catalog";

/**
 * Cached across serverless instances (unlike a module-level variable, which
 * only helps a single long-lived process and is a no-op on Vercel). Falls
 * back to a 300s TTL; ingest calls revalidateTag(CATALOG_CACHE_TAG) to bust
 * it as soon as new episodes land, so the TTL is a ceiling, not the norm.
 */
const getCachedCatalog = unstable_cache(loadAppCatalogUncached, ["catalog"], {
  revalidate: 300,
  tags: [CATALOG_CACHE_TAG],
});

export async function loadAppCatalog(): Promise<Catalog> {
  return getCachedCatalog();
}
