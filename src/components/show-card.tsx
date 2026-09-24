import Link from "next/link";

import type { Show } from "../lib/catalog.ts";
import { youtubeThumbUrl } from "../lib/thumbs.ts";

export type ShowCardProps = {
  show: Show;
  slug: string;
  averageScore: number | null;
};

function formatScorePill(averageScore: number | null): string | null {
  if (averageScore === null) {
    return null;
  }

  return averageScore.toFixed(1);
}

export function ShowCard({ show, slug, averageScore }: ShowCardProps) {
  const scorePill = formatScorePill(averageScore);

  return (
    <Link className="show-card" href={`/shows/${slug}`}>
      <div className="show-card__thumb">
        <img
          src={youtubeThumbUrl(show.coverVideoId)}
          alt={show.name}
          className="show-card__img"
        />
        {scorePill ? <span className="show-card__score">{scorePill}</span> : null}
      </div>
      <h4 className="show-card__title">{show.name}</h4>
      <p className="show-card__meta">{show.host} · {show.category}</p>
    </Link>
  );
}
