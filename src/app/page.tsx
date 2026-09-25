import { Directory } from "../components/directory.tsx";
import { Hero } from "../components/hero.tsx";
import { SiteHeader } from "../components/site-header.tsx";
import { UpcomingStrip } from "../components/upcoming-strip.tsx";
import { loadAppCatalog } from "../lib/catalog-cache.ts";
import { slugFromName, type Show } from "../lib/catalog.ts";
import { getReviewsPool } from "../lib/reviews-db.ts";
import {
  combineEpisodeScores,
  emptyEpisodeScore,
  listEpisodeScores,
} from "../lib/reviews-pg.ts";
import { splitSchedule } from "../lib/schedule.ts";

export const revalidate = 300;

type ShowWithScore = {
  show: Show;
  slug: string;
  averageScore: number | null;
};

/** Highest-rated show, falling back to the first (alphabetical) show before any reviews exist. */
function pickFeatured(shows: ShowWithScore[]): ShowWithScore {
  return shows.reduce((best, entry) => {
    const bestScore = best.averageScore ?? -1;
    const entryScore = entry.averageScore ?? -1;
    return entryScore > bestScore ? entry : best;
  }, shows[0]);
}

export default async function HomePage() {
  const catalog = await loadAppCatalog();
  const scores = await listEpisodeScores(getReviewsPool());

  const shows = catalog.shows.map((show) => ({
    show,
    slug: slugFromName(show.name),
    averageScore: combineEpisodeScores(
      show.episodes.map((episode) => scores.get(episode.videoId) ?? emptyEpisodeScore()),
    ).average,
  }));

  const featured = pickFeatured(shows);
  const featuredEpisode = featured.show.episodes[0];
  const upcoming = splitSchedule(catalog).upcoming;

  return (
    <>
      <SiteHeader current="discover" />
      <div className="mx-auto grid max-w-[1080px] gap-4 px-5 pt-6">
        {featuredEpisode ? (
          <Hero show={featured.show} slug={featured.slug} episodeId={featuredEpisode.videoId} />
        ) : null}
        <UpcomingStrip entries={upcoming} />
      </div>
      <Directory catalog={catalog} shows={shows} />
    </>
  );
}
