# Panel platform wireframe

## Flow

From Discover you filter or search the 16 shows, open a show, then an episode. The episode plays on this page. You can save it or leave a star rating and a short review; a spoiler stays hidden until you ask to see it. Upcoming separates dated premieres from the aired archive. A person page lists every episode they host and every episode they guest. Library, on this browser only, holds continue-watching, history, and the watchlist.

## Empty and error states

- Search with no matches shows “No shows match” and the active query. Filters stay visible.
- Upcoming has no dated premieres in the seed. That state says nothing is announced, and the aired archive stays below it.
- Library before any watch is empty: nothing in progress, nothing saved.
- A bad show or episode link says it does not match the catalog.
- A YouTube episode has no Cast control. Cast appears only when the episode has a media file and a device is available.
- A review marked as a spoiler shows the author, stars, and a “Show spoiler” control. The body stays hidden.
- Submitting a review asks for a display name. The same browser replaces its previous review of that episode.

## Mobbin

One `search_flows` call, web, for browsing a catalog, watching, and rating. Mobbin refused the call: a paid plan is required (`https://mobbin.com/pricing`). No `mobbin_url` to cite.
