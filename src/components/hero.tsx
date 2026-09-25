import Image from "next/image";
import Link from "next/link";

import type { Show } from "../lib/catalog.ts";
import { youtubeThumbUrl } from "../lib/thumbs.ts";

export type HeroProps = {
  show: Show;
  slug: string;
  episodeId: string;
};

export function Hero({ show, slug, episodeId }: HeroProps) {
  const episodeCount = show.episodes.length;

  return (
    <Link
      href={`/shows/${slug}/episodes/${episodeId}`}
      className="group relative block aspect-[4/3] overflow-hidden rounded-card bg-[#1a1520] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:aspect-[21/9]"
    >
      <Image
        src={youtubeThumbUrl(show.coverVideoId)}
        alt=""
        className="object-cover transition-transform duration-slow ease-out group-hover:scale-[1.03]"
        fill
        sizes="100vw"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg-deep from-15% via-bg-deep/60 via-45% to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
        <span className="mb-2 inline-block rounded-pill bg-accent-muted px-2.5 py-1 text-xs font-bold text-accent sm:mb-2.5">
          Featured
        </span>
        <h2 className="m-0 text-xl leading-[1.1] tracking-[-0.02em] text-text sm:text-[32px] sm:leading-[1.08] sm:tracking-[-0.03em]">
          {show.name}
        </h2>
        <p className="m-0 mt-1.5 max-w-lg text-sm text-text-muted sm:text-base">
          Hosted by {show.host} · {show.category} · {episodeCount}{" "}
          {episodeCount === 1 ? "episode" : "episodes"}
        </p>
      </div>
    </Link>
  );
}
