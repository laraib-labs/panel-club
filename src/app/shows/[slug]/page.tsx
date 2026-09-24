import type { DatabaseSync } from "node:sqlite";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "../../../components/site-header.tsx";
import { getShow, loadCatalog, slugFromName, type Show } from "../../../lib/catalog.ts";
import { openReviewsDb } from "../../../lib/reviews-db.ts";
import { averageScore, listReviews } from "../../../lib/reviews.ts";
import { youtubeThumbUrl } from "../../../lib/thumbs.ts";

function showScoreSummary(db: DatabaseSync, show: Show): { average: number | null; reviewCount: number } {
  let total = 0;
  let count = 0;

  for (const episode of show.episodes) {
    for (const review of listReviews(db, episode.videoId)) {
      total += review.stars;
      count += 1;
    }
  }

  return {
    average: count === 0 ? null : total / count,
    reviewCount: count,
  };
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

function formatScorePill(average: number | null): string | null {
  if (average === null) {
    return null;
  }

  return average.toFixed(1);
}

type ShowPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ShowPage({ params }: ShowPageProps) {
  const { slug } = await params;
  const catalog = loadCatalog();
  const show = getShow(catalog, slug);

  if (!show) {
    notFound();
  }

  const db = openReviewsDb();
  const score = showScoreSummary(db, show);
  const scorePill = formatScorePill(score.average);

  return (
    <>
      <SiteHeader current="discover" />
      <div className="pad">
        <p className="meta">
          <Link href="/">Discover</Link> / {show.name}
        </p>
        <div className="show-cover">
          <img
            src={youtubeThumbUrl(show.coverVideoId)}
            alt={show.name}
            className="show-cover__img"
          />
          {scorePill ? <span className="show-cover__score">{scorePill}</span> : null}
        </div>
        <h3>{show.name}</h3>
        <p className="meta">
          Hosted by {show.host} · {show.category} · {formatShowScore(score.average, score.reviewCount)}
        </p>
        {show.availabilityNote ? <p className="note">{show.availabilityNote}</p> : null}
        {show.episodes.map((episode) => {
          const episodeReviews = listReviews(db, episode.videoId);
          const episodeScore = averageScore(db, episode.videoId);
          const statusLabel = episode.status === "upcoming" ? "Upcoming" : "Aired";

          return (
            <Link
              key={episode.videoId}
              className="episode-row"
              href={`/shows/${slugFromName(show.name)}/episodes/${episode.videoId}`}
            >
              <div className="episode-row__thumb">
                <img
                  src={youtubeThumbUrl(episode.videoId)}
                  alt={episode.title}
                  className="episode-row__img"
                />
                <span className="episode-row__badge">{formatDuration(episode.duration)}</span>
              </div>
              <div className="episode-row__copy">
                <strong>{episode.title}</strong>
                <p className="meta">
                  {formatEpisodeScore(episodeScore, episodeReviews.length)} · {statusLabel}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
