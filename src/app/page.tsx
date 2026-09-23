import type { DatabaseSync } from "node:sqlite";

import { Directory } from "../components/directory.tsx";
import { SiteHeader } from "../components/site-header.tsx";
import { loadCatalog, slugFromName, type Show } from "../lib/catalog.ts";
import { openReviewsDb } from "../lib/reviews-db.ts";
import { listReviews } from "../lib/reviews.ts";

function showAverageScore(db: DatabaseSync, show: Show): number | null {
  let total = 0;
  let count = 0;

  for (const episode of show.episodes) {
    for (const review of listReviews(db, episode.videoId)) {
      total += review.stars;
      count += 1;
    }
  }

  if (count === 0) {
    return null;
  }

  return total / count;
}

export const dynamic = "force-dynamic";

export default function HomePage() {
  const catalog = loadCatalog();
  const db = openReviewsDb();

  const shows = catalog.shows.map((show) => ({
    show,
    slug: slugFromName(show.name),
    averageScore: showAverageScore(db, show),
  }));

  return (
    <>
      <SiteHeader current="discover" />
      <Directory catalog={catalog} shows={shows} />
    </>
  );
}
