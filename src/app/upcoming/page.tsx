import { Schedule } from "../../components/schedule.tsx";
import { loadCatalog } from "../../lib/catalog.ts";
import { splitSchedule } from "../../lib/schedule.ts";

export default function UpcomingPage() {
  const catalog = loadCatalog();
  const schedule = splitSchedule(catalog);

  return <Schedule schedule={schedule} />;
}
