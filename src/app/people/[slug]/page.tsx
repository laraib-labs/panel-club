import { notFound } from "next/navigation";

import { SiteHeader } from "../../../components/site-header.tsx";
import { loadCatalog, slugFromName } from "../../../lib/catalog.ts";
import { appearances } from "../../../lib/people.ts";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const person = appearances(loadCatalog(), slug);
  if (!person) {
    notFound();
  }

  return (
    <>
      <SiteHeader current="people" />
      <div className="pad">
        <h1>{person.name}</h1>
        <section>
          <h2>Hosts</h2>
          {person.hosted.length === 0 ? <p className="meta">No shows hosted.</p> : null}
          {person.hosted.map(({ show, episode }) => (
            <p key={`h-${episode.videoId}`}>
              <a href={`/shows/${slugFromName(show.name)}/episodes/${episode.videoId}`}>
                {show.name} · {episode.title}
              </a>
            </p>
          ))}
        </section>
        <section>
          <h2>Guest</h2>
          {person.guested.length === 0 ? <p className="meta">No guest episodes.</p> : null}
          {person.guested.map(({ show, episode }) => (
            <p key={`g-${episode.videoId}`}>
              <a href={`/shows/${slugFromName(show.name)}/episodes/${episode.videoId}`}>
                {show.name} · {episode.title}
              </a>
            </p>
          ))}
        </section>
      </div>
    </>
  );
}
