import { loadCatalog } from "../../lib/catalog.ts";
import { listPeople } from "../../lib/people.ts";

export function getPeoplePageData() {
  const catalog = loadCatalog();
  return {
    people: listPeople(catalog),
  };
}
