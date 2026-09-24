import { Directory } from "../components/directory.tsx";
import { SiteHeader } from "../components/site-header.tsx";
import { loadAppCatalog, slugFromName, type Show } from "../lib/catalog.ts";
import { getReviewsPool, openReviewsDb, reviewsUsesPostgres } from "../lib/reviews-db.ts";
import { listReviews, listReviewsPg } from "../lib/reviews.ts";

async function showAverageScore(show: Show): Promise<number | null> {
  let total = 0;
  let count = 0;

  if (reviewsUsesPostgres()) {
    const pool = getReviewsPool();
    for (const episode of show.episodes) {
      for (const review of await listReviewsPg(pool, episode.videoId)) {
        total += review.stars ?? 0;
        count += 1;
      }
    }
  } else {
    const db = openReviewsDb();
    for (const episode of show.episodes) {
      for (const review of listReviews(db, episode.videoId)) {
        total += review.stars ?? 0;
        count += 1;
      }
    }
  }

  if (count === 0) {
    return null;
  }

  return total / count;
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await loadAppCatalog();

  const shows = await Promise.all(
    catalog.shows.map(async (show) => ({
      show,
      slug: slugFromName(show.name),
      averageScore: await showAverageScore(show),
    })),
  );

  return (
    <>
      <SiteHeader current="discover" />
      <Directory catalog={catalog} shows={shows} />
    </>
  );
}
