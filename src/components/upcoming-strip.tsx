import Link from "next/link";

import { slugFromName } from "../lib/catalog.ts";
import type { UpcomingEntry } from "../lib/schedule.ts";

export type UpcomingStripProps = {
  entries: UpcomingEntry[];
};

function formatPremiereDate(premieresAt: string): string {
  const date = new Date(`${premieresAt}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function UpcomingStrip({ entries }: UpcomingStripProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1" aria-label="Upcoming episodes">
      {entries.map(({ show, episode }) => (
        <Link
          key={episode.videoId}
          href={`/shows/${slugFromName(show.name)}/episodes/${episode.videoId}`}
          className="shrink-0 whitespace-nowrap rounded-card border border-border-subtle bg-surface px-4 py-2.5 text-sm transition-colors duration-fast ease-out hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <span className="font-semibold text-text">{show.name}</span>
          <span className="text-text-muted"> · </span>
          <span className="font-semibold text-accent">
            {episode.premieresAt ? `Premieres ${formatPremiereDate(episode.premieresAt)}` : "Premieres soon"}
          </span>
        </Link>
      ))}
    </div>
  );
}
