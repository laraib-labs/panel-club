import Image from "next/image";
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
    <Link
      href={`/shows/${slug}`}
      className="group block overflow-hidden rounded-card border border-border-subtle bg-surface transition-all duration-base ease-out hover:-translate-y-0.5 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div className="relative aspect-video overflow-hidden bg-[#1a1520]">
        <Image
          src={youtubeThumbUrl(show.coverVideoId)}
          alt={show.name}
          className="object-cover"
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
        />
        {scorePill ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-bg/70 px-2 py-0.5 text-xs font-semibold text-accent backdrop-blur-sm">
            <span aria-hidden="true">★</span>
            {scorePill}
          </span>
        ) : null}
      </div>
      <h4 className="mt-2.5 px-3.5 text-[17px] font-semibold normal-case tracking-tight text-text transition-colors duration-fast group-hover:text-accent-hover">
        {show.name}
      </h4>
      <p className="m-0 px-3.5 pb-3.5 text-sm text-text-muted">
        {show.host} · {show.category}
      </p>
    </Link>
  );
}
