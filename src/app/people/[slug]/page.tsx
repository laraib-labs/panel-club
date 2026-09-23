import { loadCatalog } from "../../../lib/catalog.ts";
import { appearances } from "../../../lib/people.ts";

export async function getPersonPageData(params: Promise<{ slug: string }>) {
  const { slug } = await params;
  const catalog = loadCatalog();
  const person = appearances(catalog, slug);

  return {
    person,
  };
}
