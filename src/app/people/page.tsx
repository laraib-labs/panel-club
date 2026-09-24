import { PeopleList } from "../../components/people-list.tsx";
import { SiteHeader } from "../../components/site-header.tsx";
import { loadCatalog } from "../../lib/catalog.ts";
import { listPeople } from "../../lib/people.ts";

export default function Page() {
  const people = listPeople(loadCatalog());

  return (
    <>
      <SiteHeader current="people" />
      <PeopleList people={people} />
    </>
  );
}
