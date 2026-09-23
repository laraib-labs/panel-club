# Panel platform — UI spec

The implementer follows this file. The HTML is the picture.

## Header

One floating app bar, shared by every screen. It stays put while the page scrolls. Discover, Upcoming, People, and Library replace the page in place. They do not scroll to another section. Discover covers the directory, a show, an episode, search with no matches, and not-found. Upcoming covers both upcoming states. People covers the list and a person. Library covers the filled library and the empty one.

## directory

- purpose: Find a show among the 16.
- primary action: Open a show card.
- navigates to: show
- states: default. Empty search is `search-empty`.
- locked copy: “Find your kind of funny”; “16 shows. Search, then open a show.”; search placeholder “Search shows, hosts, guests or episodes”; chips “All shows”, “Panel shows”, “Game shows”, “Roasts”, “Advice & banter”.

## show

- purpose: See the host, the availability note, the score, and the episodes.
- primary action: Open an episode.
- navigates to: episode (YouTube rows) or episode-cast (the file example only).
- states: default
- locked copy: “India's Got Latent”; “Hosted by Samay Raina”; “Panel shows”; “4.6 from 12 reviews”; “Season 1 is no longer public on the official channel. The cover is Season 2, Episode 1.”

## episode

- purpose: Play a YouTube episode on this page and leave one review from this browser.
- primary action: Submit review
- navigates to: stays
- states: default (YouTube, Cast hidden, one spoiler collapsed)
- locked copy: “Playing on this page”; “Save”; “Mark finished”; “Show spoiler”; “Your review replaces the last one from this browser”; “Display name”; “This review spoils the episode”; “Submit review”. No Cast control.

## episode-cast

- purpose: Show where Cast sits when the episode is a file and a device is available.
- primary action: Cast
- navigates to: stays
- states: default (file + device)
- locked copy: “Example file episode”; “Not in the YouTube seed. Shown only so Cast has a place.”; “Cast”; “Cast opens the device picker. Play and pause stay on this page.”

## upcoming

- purpose: Show a dated premiere above the aired archive.
- primary action: Open the premiere row.
- navigates to: episode
- states: default (one example dated row; the seed itself has none)
- locked copy: “Upcoming”; “Lie Hard · S4 EP1”; “Gaurav Kapoor”; “Premieres 4 Oct 2026”; “Aired”.

## upcoming-empty

- purpose: The real seed: nothing is announced, the archive remains.
- primary action: Open an aired show.
- navigates to: show
- states: empty
- locked copy: “Nothing announced. New tapings show up here with a date.”; “Aired”.

## people

- purpose: Pick a host or guest.
- primary action: Open a person.
- navigates to: person
- states: default
- locked copy: “People”; “Hosts and guests across the 16 shows.”

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

- purpose: Search or filter matched nothing.
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

- Accounts, passwords, follow alerts, ticket links, clip timestamps, comment threads.
- A Cast control on YouTube episodes, a Cast receiver app, downloading, or restreaming YouTube.
- The reference site’s spotlight carousel, logo, and photo tiles.
- Editing the header from any slice other than the directory slice. Header labels are Discover, Upcoming, People, Library.
