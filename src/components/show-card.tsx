import Link from "next/link";

import type { Show } from "../lib/catalog.ts";

export type ShowCardProps = {
  show: Show;
  slug: string;
  averageScore: number | null;
};

function formatScore(averageScore: number | null): string {
  if (averageScore === null) {
    return "No score yet";
  }

  return averageScore.toFixed(1);
}

export function ShowCard({ show, slug, averageScore }: ShowCardProps) {
  const episodeLabel = show.episodes.length === 1 ? "episode" : "episodes";

  return (
    <Link className="card" href={`/shows/${slug}`}>
      <h4>{show.name}</h4>
      <p className="meta">{show.host} · {show.category}</p>
      <p className="meta">
        {show.episodes.length} {episodeLabel} · {formatScore(averageScore)}
      </p>
    </Link>
  );
}
