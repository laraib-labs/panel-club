# Panel platform wireframe

## Flow

From Discover you search or filter the 16 shows and open one. The show lists its episodes; an episode plays on this page, where you save it or leave a star rating and a short review. A spoiler stays hidden until you ask to see it. Upcoming separates dated premieres from the aired archive. People is a list; a person page lists every episode they host and every episode they guest. Library, on this browser only, holds continue-watching, history, and the watchlist.

## Guide

Material 3 (one lookup, web structure): a screen is an app bar for navigation, a body, and one obvious primary action. When search is the job of the view, the search bar stays at the top of that view and results are a list of cards. An empty result keeps the search bar and the filters, and says the list matched nothing.

Applied here: one floating app bar holds Discover, Upcoming, People, and Library. Choosing one replaces the page underneath. It does not scroll the wireframe. Discover’s primary path is opening a show from the card list; search and the four category chips stay on the screen. Other screens put the next step in a filled accent button (open episode, submit review, cast, continue, back to Discover).

## Empty and error states

- Search with no matches shows “No shows match” and the active query. Filters stay visible.
- Upcoming has no dated premieres in the seed. That state says nothing is announced, and the aired archive stays below it.
- A separate Upcoming section shows one dated premiere so the row has a shape when a date exists.
- Library before any watch is empty: nothing in progress, nothing saved, with a way back to Discover.
- A bad show or episode link says it does not match the catalog.
- A YouTube episode has no Cast control. Cast appears only when the episode has a media file and a device is available.
- A review marked as a spoiler shows the author, stars, and a “Show spoiler” control. The body stays hidden.
- Submitting a review asks for a display name. The same browser replaces its previous review of that episode.

## Reference

- URL: https://panel-club.vercel.app/
- Flow: a directory of 16 Indian comedy shows, with category chips and search across titles, hosts, guests, and episodes. It does not open an episode, play video, store a rating, or list upcoming dates.
- Used from it: dark field, one lime accent, category chips, show title plus host. Left behind: the spotlight carousel, the logo, and the photo grid. Cards here add the score and episode count this product needs.

## Feedback

- directory (`directory-filter-all`, not approved): Discover, Upcoming, People, and Library are page headers. Clicking one should not jump down the stacked wireframe. They should be a floating header, and the same treatment applies to each of those buttons.
- not-found (not approved): Clicking Discover does the same jump. The note was cut off at “clicking on disc”.
