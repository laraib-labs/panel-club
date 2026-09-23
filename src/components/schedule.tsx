import { slugFromName } from "../lib/catalog.ts";
import type { SplitSchedule } from "../lib/schedule.ts";

type ScheduleProps = {
  schedule: SplitSchedule;
};

function formatPremiereDate(premieresAt: string): string {
  const date = new Date(`${premieresAt}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function Schedule({ schedule }: ScheduleProps) {
  const { upcoming, aired } = schedule;

  return (
    <main>
      <h1>Upcoming</h1>

      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p>Nothing announced.</p>
        ) : (
          <ul>
            {upcoming.map(({ show, episode }) => (
              <li key={episode.videoId}>
                <a href={`/shows/${slugFromName(show.name)}/episodes/${episode.videoId}`}>
                  <strong>{show.name} · {episode.title}</strong>
                  {episode.premieresAt ? (
                    <p>{show.host} · Premieres {formatPremiereDate(episode.premieresAt)}</p>
                  ) : (
                    <p>{show.host}</p>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="aired-heading">
        <h2 id="aired-heading">Aired</h2>
        <ul>
          {aired.map(({ show, episodeCount }) => (
            <li key={show.name}>
              <a href={`/shows/${slugFromName(show.name)}`}>
                <strong>{show.name}</strong>
                <p>{episodeCount} episodes · {show.host}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
