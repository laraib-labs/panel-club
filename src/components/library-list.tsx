export type LibraryEpisodeItem = {
  episodeId: string;
  title: string;
  meta: string;
  href: string;
};

export type LibraryListProps = {
  continue: LibraryEpisodeItem[];
  history: LibraryEpisodeItem[];
  saved: LibraryEpisodeItem[];
};

function EpisodeSection({
  heading,
  items,
}: {
  heading: string;
  items: LibraryEpisodeItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <h4>{heading}</h4>
      {items.map((item) => (
        <a className="ep" href={item.href} key={item.episodeId}>
          <strong>{item.title}</strong>
          <p className="meta">{item.meta}</p>
        </a>
      ))}
    </>
  );
}

export function LibraryList({ continue: continueItems, history, saved }: LibraryListProps) {
  return (
    <div className="pad">
      <h3>Your library</h3>
      <p className="meta">Stored in this browser. Not an account.</p>
      <EpisodeSection heading="Continue" items={continueItems} />
      <EpisodeSection heading="History" items={history} />
      <EpisodeSection heading="Watchlist" items={saved} />
    </div>
  );
}
