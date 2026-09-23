import { LibraryBrowser } from "../../components/library-list.tsx";
import { SiteHeader } from "../../components/site-header.tsx";
import { loadCatalog, slugFromName } from "../../lib/catalog.ts";

export default function Page() {
  const catalog = loadCatalog();
  const episodes = catalog.shows.flatMap((show) => {
    const slug = slugFromName(show.name);
    return show.episodes.map((episode) => ({
      episodeId: episode.videoId,
      title: `${show.name} · ${episode.title}`,
      href: `/shows/${slug}/episodes/${episode.videoId}`,
    }));
  });

  return (
    <>
      <SiteHeader current="library" />
      <LibraryBrowser episodes={episodes} />
    </>
  );
}
