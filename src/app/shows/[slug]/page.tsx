import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "../../../components/site-header.tsx";
import { loadAppCatalog } from "../../../lib/catalog-cache.ts";
import { getShow, slugFromName } from "../../../lib/catalog.ts";
import { getReviewsPool } from "../../../lib/reviews-db.ts";
import {
  combineEpisodeScores,
  emptyEpisodeScore,
  listEpisodeScores,
} from "../../../lib/reviews-pg.ts";
import { youtubeThumbUrl } from "../../../lib/thumbs.ts";

export const revalidate = 300;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const catalog = await loadAppCatalog();
  return catalog.shows.map((show) => ({ slug: slugFromName(show.name) }));
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function formatEpisodeScore(score: number | null, reviewCount: number): string {
  if (score === null || reviewCount === 0) {
    return "No score yet";
  }

  const reviewLabel = reviewCount === 1 ? "review" : "reviews";
  return `${score.toFixed(1)} from ${reviewCount} ${reviewLabel}`;
}

function formatShowScore(average: number | null, reviewCount: number): string {
  if (average === null || reviewCount === 0) {
    return "No score yet";
  }

  const reviewLabel = reviewCount === 1 ? "review" : "reviews";
  return `${average.toFixed(1)} from ${reviewCount} ${reviewLabel}`;
}

type ShowPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ShowPage({ params }: ShowPageProps) {
  const { slug } = await params;
  const catalog = await loadAppCatalog();
  const show = getShow(catalog, slug);

  if (!show) {
    notFound();
  }

  const scores = await listEpisodeScores(getReviewsPool());
  const score = combineEpisodeScores(
    show.episodes.map((episode) => scores.get(episode.videoId) ?? emptyEpisodeScore()),
  );

  const episodeRows = show.episodes.map((episode, index) => {
    const episodeScore = scores.get(episode.videoId) ?? emptyEpisodeScore();

    return {
      number: index + 1,
      episode,
      episodeScore: episodeScore.average,
      reviewCount: episodeScore.reviewCount,
      statusLabel: episode.status === "upcoming" ? "Upcoming" : "Aired",
    };
  });

  return (
    <>
      <SiteHeader current="discover" />
      <div className="mx-auto grid max-w-[1080px] gap-4 px-5 pb-7 pt-6">
        <p className="meta">
          <Link href="/">Discover</Link> / {show.name}
        </p>

        <div className="relative aspect-[18/7] overflow-hidden rounded-card bg-[#1a1520]">
          <Image
            src={youtubeThumbUrl(show.coverVideoId)}
            alt=""
            className="object-cover"
            fill
            sizes="(max-width: 1080px) 100vw, 1080px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-deep via-bg-deep/25 to-transparent" />
          <h1 className="absolute inset-x-0 bottom-0 m-0 p-6 text-2xl leading-[1.08] tracking-[-0.03em] text-text sm:text-4xl">
            {show.name}
          </h1>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <span className="rounded-pill border border-border-subtle bg-surface px-3.5 py-2 text-sm text-text-muted">
            Hosted by <b className="font-semibold text-text">{show.host}</b>
          </span>
          <span className="rounded-pill border border-border-subtle bg-surface px-3.5 py-2 text-sm text-text-muted">
            <b className="font-semibold text-text">{show.category}</b>
          </span>
          <span className="rounded-pill border border-border-subtle bg-surface px-3.5 py-2 text-sm text-text-muted">
            <b className="font-semibold text-text">{formatShowScore(score.average, score.reviewCount)}</b>
          </span>
        </div>

        {show.availabilityNote ? (
          <p className="m-0 rounded-xl bg-[#2a1824] px-3.5 py-3 text-text">
            {show.availabilityNote}
          </p>
        ) : null}

        <div className="grid gap-2">
          {episodeRows.map(({ number, episode, episodeScore, reviewCount, statusLabel }) => (
            <Link
              key={episode.videoId}
              className="grid grid-cols-[28px_100px_1fr_auto] items-center gap-3.5 rounded-card border border-border-subtle bg-surface px-3.5 py-2.5 transition-colors duration-fast ease-out hover:border-border hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              href={`/shows/${slugFromName(show.name)}/episodes/${episode.videoId}`}
            >
              <span className="text-center text-sm text-text-subtle">{number}</span>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-[#1a1520]">
                <Image
                  src={youtubeThumbUrl(episode.videoId)}
                  alt=""
                  className="object-cover"
                  fill
                  sizes="100px"
                />
              </div>
              <div className="min-w-0">
                <p className="m-0 truncate text-[15px] font-semibold tracking-tight text-text">
                  {episode.title}
                </p>
                <p className="meta truncate">
                  {formatDuration(episode.duration)} · {formatEpisodeScore(episodeScore, reviewCount)}
                </p>
              </div>
              <span className="whitespace-nowrap text-xs text-text-subtle">{statusLabel}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
