import { notFound } from "next/navigation";

import { SiteHeader } from "../../../components/site-header.tsx";
import { loadAppCatalog } from "../../../lib/catalog-cache.ts";
import { slugFromName, type Show } from "../../../lib/catalog.ts";
import { appearances, listPeople } from "../../../lib/people.ts";
import { personMonogram } from "../../../lib/people-view.ts";

export const revalidate = 300;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const catalog = await loadAppCatalog();
  return listPeople(catalog).map((person) => ({ slug: person.slug }));
}

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

  const linkRowClassName =
    "block rounded-card border border-border-subtle bg-surface px-4 py-3 text-[15px] font-medium text-text transition-colors duration-fast ease-out hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

  return (
    <>
      <SiteHeader current="people" />
      <div className="mx-auto grid max-w-[1080px] gap-4 px-5 pb-7 pt-6">
        <p className="meta">
          <a href="/people">People</a> / {person.name}
        </p>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface-raised text-lg font-extrabold text-accent"
          >
            {personMonogram(person.name)}
          </span>
          <h1 className="m-0 text-[26px] sm:text-4xl leading-[1.08] tracking-[-0.04em] text-text">
            {person.name}
          </h1>
        </div>
        {hostedShows.length > 0 ? (
          <section className="grid gap-2">
            <h2 className="text-xs uppercase tracking-[0.1em] text-text-muted">Hosts</h2>
            <ul className="m-0 grid list-none gap-2 p-0">
              {hostedShows.map(({ show, episodeCount }) => (
                <li key={slugFromName(show.name)}>
                  <a className={linkRowClassName} href={`/shows/${slugFromName(show.name)}`}>
                    {formatHostedShowLabel(show, person.name, episodeCount)}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {person.guested.length > 0 ? (
          <section className="grid gap-2">
            <h2 className="text-xs uppercase tracking-[0.1em] text-text-muted">Guest</h2>
            <ul className="m-0 grid list-none gap-2 p-0">
              {person.guested.map(({ show, episode }) => (
                <li key={episode.videoId}>
                  <a
                    className={linkRowClassName}
                    href={`/shows/${slugFromName(show.name)}/episodes/${episode.videoId}`}
                  >
                    {show.name} · {episode.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
