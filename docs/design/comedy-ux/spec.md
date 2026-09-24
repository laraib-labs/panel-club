# Comedy UX — UI spec

The implementer follows this file. The HTML is the picture.

## Header

One floating app bar on every screen. Discover, Upcoming, People, and Library replace the page. They do not jump inside a stacked document. Discover covers directory, show, episode, episode-blocked, search-empty, not-found. Upcoming covers upcoming and upcoming-empty. People covers people, people-empty, person. Library covers library and library-empty.

## directory

- purpose: Find a show among the 16 from posters.
- primary action: Open a show card.
- navigates to: show
- states: default. Empty search is `search-empty`.
- locked copy: “Find your kind of funny”; “16 shows. Search, then open a show.”; search placeholder “Search shows, hosts, guests or episodes”; chips “All shows”, “Panel shows”, “Game shows”, “Roasts”, “Advice & banter”.

## show

- purpose: See the host, availability note, show score, and episode posters with each episode’s own score.
- primary action: Open an episode.
- navigates to: episode
- states: default
- locked copy: “India's Got Latent”; “Hosted by Samay Raina”; “Panel shows”; “4.6 from 12 reviews”; “Season 1 is no longer public on the official channel. The cover is Season 2, Episode 1.”; episode row meta includes that episode’s score (“4.8 from 5 reviews” or “No score yet”).

## episode

- purpose: Play on this page (full-bleed 16:9, fullscreen) and leave a starred review; reply once under someone else’s review.
- primary action: Submit review
- navigates to: stays
- states: default (YouTube playing, one spoiler collapsed, one reply visible)
- locked copy: “Playing on this page”; “Open on YouTube”; “Save”; “Mark finished”; “Show spoiler”; “Your review replaces the last one from this browser”; “Display name”; “This review spoils the episode”; “Submit review”; “Reply”; “Be the first.” (empty list only — not this state)

## episode-blocked

- purpose: Same episode when the iframe will not play.
- primary action: Open on YouTube
- navigates to: stays (YouTube in a new tab in the product)
- states: error
- locked copy: “This episode won’t play here.”; “YouTube blocked the embed (age gate or embedding off).”; “Open on YouTube”; “Save”; “Mark finished”.

## upcoming

- purpose: Show a dated premiere above the aired archive.
- primary action: Open the premiere row.
- navigates to: episode
- states: default
- locked copy: “Upcoming”; “Lie Hard · S4 EP1”; “Gaurav Kapoor”; “Premieres 4 Oct 2026”; “Aired”.

## upcoming-empty

- purpose: The real seed: nothing announced; archive remains.
- primary action: Open an aired show.
- navigates to: show
- states: empty
- locked copy: “Nothing announced. New tapings show up here with a date.”; “Aired”.

## people

- purpose: Find a host or guest by name.
- primary action: Open a person.
- navigates to: person
- states: default. Empty search is `people-empty`.
- locked copy: “People”; “Hosts and guests across the 16 shows.”; search placeholder “Search people”.

## people-empty

- purpose: People search matched nothing.
- primary action: Clear
- navigates to: stays (returns the people list)
- states: empty
- locked copy: “People”; “No people match “xyz”.”; “Clear”.

## person

- purpose: List what this person hosts and where they guest, once each.
- primary action: Open an appearance.
- navigates to: show (host rows) or episode (guest rows)
- states: default
- locked copy: “Kaustubh Agarwal”; “Hosts”; “Guest”.

## library

- purpose: Resume, revisit, or open a saved episode on this browser.
- primary action: Open the continue row.
- navigates to: episode
- states: default
- locked copy: “Your library”; “Stored in this browser. Not an account.”; “Continue”; “History”; “Watchlist”.

## library-empty

- purpose: Library before any watch or save.
- primary action: Discover shows
- navigates to: directory
- states: empty
- locked copy: “Your library”; “Nothing in progress. You have not saved an episode.”; “Discover shows”.

## search-empty

- purpose: Discover search or filter matched nothing.
- primary action: Clear
- navigates to: stays (returns the directory list)
- states: empty
- locked copy: “Find your kind of funny”; “No shows match “xyz”.”; “Clear”.

## not-found

- purpose: A show or episode id is not in the catalog.
- primary action: Back to Discover
- navigates to: directory
- states: error
- locked copy: “That show or episode is not in the catalog.”; “The link may be old, or the episode was removed from the public list.”; “Back to Discover”.

## Out of scope

- Accounts, passwords, follow alerts, ticket links, clip timestamps, reply-to-reply, moderation tools, CAPTCHA.
- A Cast control on YouTube episodes, a Cast receiver app, downloading, or restreaming YouTube.
- Dropout logo, yellow promo bar, sign-in, trial, spotlight carousel.
- Scraped people photos. Editing the header from any slice other than directory. Header labels stay Discover, Upcoming, People, Library.
