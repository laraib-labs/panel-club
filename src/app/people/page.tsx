import { SiteHeader } from "../../components/site-header.tsx";
import { loadCatalog } from "../../lib/catalog.ts";
import { listPeople } from "../../lib/people.ts";

export default function Page() {
  const people = listPeople(loadCatalog());

  return (
    <>
      <SiteHeader current="people" />
      <div className="pad">
        <h1>People</h1>
        <ul>
          {people.map((person) => (
            <li key={person.slug}>
              <a href={`/people/${person.slug}`}>{person.name}</a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
