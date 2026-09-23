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
    <div className="pad">
      <h3>Upcoming</h3>

      {upcoming.length === 0 ? (
        <p className="empty">Nothing announced. New tapings show up here with a date.</p>
      ) : (
        upcoming.map(({ show, episode }) => (
          <a
            className="ep"
            href={`/shows/${slugFromName(show.name)}/episodes/${episode.videoId}`}
            key={episode.videoId}
          >
            <strong>{show.name} · {episode.title}</strong>
            {episode.premieresAt ? (
              <p className="meta">{show.host} · Premieres {formatPremiereDate(episode.premieresAt)}</p>
            ) : (
              <p className="meta">{show.host}</p>
            )}
          </a>
        ))
      )}

      <h4>Aired</h4>
      {aired.map(({ show, episodeCount }) => (
        <a className="ep" href={`/shows/${slugFromName(show.name)}`} key={show.name}>
          <strong>{show.name}</strong>
          <p className="meta">{episodeCount} episodes · {show.host}</p>
        </a>
      ))}
    </div>
  );
}
