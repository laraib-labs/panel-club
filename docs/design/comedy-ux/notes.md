# Comedy UX wireframe

## Flow

Pinned app bar (Discover, Upcoming, People, Library) replaces the page. Discover is a poster grid with search at the top of that view; a show opens episode rows with thumbs; an episode is a full-bleed 16:9 player, then reviews (stars + body + optional one-level reply). If the embed cannot play, the same stage shows Open on YouTube. People is a searchable monogram list. Library is continue / history / watchlist on this browser.

## Guide

Material 3 (one lookup, web structure): pinned top app bar; when search is the job of the view, the search bar stays at the top of that view and results are cards or a list; empty results keep the search field; filled accent for the one obvious next step.

Applied: floating bar stays put. Discover and People keep search on the screen. Episode’s primary action is Submit review (or Open on YouTube when the iframe is dead). Library’s primary action is the continue row.

## Empty and error states

- Discover search/filter with no shows: keep search + chips, “No shows match”, Clear.
- People search with no names: keep search, Clear.
- Upcoming with nothing dated: copy + aired archive still listed.
- Library with nothing watched or saved: Discover shows.
- Bad show/episode id: Back to Discover.
- Review list empty: “Be the first.”
- Embed blocked: Open on YouTube under the stage, episode stays listed.

## Reference

- URL: https://watch.dropout.tv/browse
- Flow: dark comedy streamer — top bar, 16:9 posters in a row, title under the thumb, duration on the image. Sign-in and a hero carousel sit on that page.
- Used: dark lean-back field, poster-first cards, duration badge on the thumb, title + one line of meta under. Left behind: yellow promo bar, Dropout wordmark, Sign in / trial, spotlight carousel (locked out of scope).

## Feedback

- show (`show-ep-1`, not approved): episode list should show that episode’s score as well as the show average.
