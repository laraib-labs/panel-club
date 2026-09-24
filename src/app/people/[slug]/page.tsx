import { notFound } from "next/navigation";

import { SiteHeader } from "../../../components/site-header.tsx";
import { loadAppCatalog, slugFromName, type Show } from "../../../lib/catalog.ts";
import { appearances } from "../../../lib/people.ts";
import { personMonogram } from "../../../lib/people-view.ts";

export const dynamic = "force-dynamic";

function coHostLabel(host: string, personName: string): string | null {
  const others = host
    .split(" & ")
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name !== personName);

  if (others.length === 0) {
    return null;
  }

  return `with ${others.join(" & ")}`;
}

function formatHostedShowLabel(show: Show, personName: string, episodeCount: number): string {
  const coHost = coHostLabel(show.host, personName);
  const episodeLabel = episodeCount === 1 ? "1 episode" : `${episodeCount} episodes`;
  return coHost ? `${show.name} · ${coHost} · ${episodeLabel}` : `${show.name} · ${episodeLabel}`;
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const person = appearances(await loadAppCatalog(), slug);
  if (!person) {
    notFound();
  }

  const hostedByShow = new Map<string, { show: Show; episodeCount: number }>();
  for (const { show } of person.hosted) {
    const showSlug = slugFromName(show.name);
    const existing = hostedByShow.get(showSlug);
    if (existing) {
      existing.episodeCount += 1;
    } else {
      hostedByShow.set(showSlug, { show, episodeCount: 1 });
    }
  }

  const hostedShows = [...hostedByShow.values()].sort((left, right) =>
    left.show.name.localeCompare(right.show.name),
  );

  return (
    <>
      <SiteHeader current="people" />
      <div className="pad">
        <p className="meta">
          <a href="/people">People</a> / {person.name}
        </p>
        <div className="people-card">
          <span className="people-monogram" aria-hidden="true">
            {personMonogram(person.name)}
          </span>
          <h1>{person.name}</h1>
        </div>
        <section>
          <h2>Hosts</h2>
          <ul>
            {hostedShows.map(({ show, episodeCount }) => (
              <li key={slugFromName(show.name)}>
                <a href={`/shows/${slugFromName(show.name)}`}>
                  {formatHostedShowLabel(show, person.name, episodeCount)}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Guest</h2>
          <ul>
            {person.guested.map(({ show, episode }) => (
              <li key={episode.videoId}>
                <a href={`/shows/${slugFromName(show.name)}/episodes/${episode.videoId}`}>
                  {show.name} · {episode.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
