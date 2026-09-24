import { Schedule } from "../../components/schedule.tsx";
import { SiteHeader } from "../../components/site-header.tsx";
import { loadAppCatalog } from "../../lib/catalog.ts";
import { splitSchedule } from "../../lib/schedule.ts";

export const dynamic = "force-dynamic";

export default async function UpcomingPage() {
  const catalog = await loadAppCatalog();
  const schedule = splitSchedule(catalog);

  return (
    <>
      <SiteHeader current="upcoming" />
      <Schedule schedule={schedule} />
    </>
  );
}
