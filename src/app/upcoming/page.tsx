import { Schedule } from "../../components/schedule.tsx";
import { SiteHeader } from "../../components/site-header.tsx";
import { loadCatalog } from "../../lib/catalog.ts";
import { splitSchedule } from "../../lib/schedule.ts";

export default function UpcomingPage() {
  const catalog = loadCatalog();
  const schedule = splitSchedule(catalog);

  return (
    <>
      <SiteHeader current="upcoming" />
      <Schedule schedule={schedule} />
    </>
  );
}
