import { PeopleList } from "../../components/people-list.tsx";
import { SiteHeader } from "../../components/site-header.tsx";
import { loadAppCatalog } from "../../lib/catalog.ts";
import { listPeople } from "../../lib/people.ts";

export const dynamic = "force-dynamic";

export default async function Page() {
  const people = listPeople(await loadAppCatalog());

  return (
    <>
      <SiteHeader current="people" />
      <PeopleList people={people} />
    </>
  );
}
