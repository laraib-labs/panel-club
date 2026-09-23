# Panel platform

A site for Indian comedy panels, game shows, and roasts: play an episode here, rate it, see who was on it, and tell aired history from what is still upcoming. Casting works the way a normal video page does when we actually have a media file.

Reference: [panel-club.vercel.app](https://panel-club.vercel.app/). That page is a Next.js directory (checked 23 Sep 2026). It lists 16 shows, filters them (Panel shows, Game shows, Roasts, Advice & banter), and searches titles, hosts, guests, and episodes. It does not route to an episode, play video, store a rating, or list anything upcoming. Show fields on that page: `name`, `host`, `category`, `description` (empty), `coverVideoId`, `sourceUrl`, `checkedAt` (21 Sep 2026), `availabilityNote`. Episode fields: `title`, `videoId`, `guest` (comma-separated, often empty), `duration` (seconds). Thumbnails are `i.ytimg.com`. Some official episodes are already missing (`availabilityNote`).

Nearby products cover a different object. [ComicAdda](https://comicadda.com/) tracks comedians and specials (rate, watched, follow, newsletter — [project note](https://anks.in/projects/comicadda)). [BrownPant](https://brownpant.com/) writes up specials and a few of these shows. Neither is a panel-episode graph with an on-site player.

## What / why

Watch and judge a panel without hunting YouTube playlists. The useful extras, in this version:

- Score and a short review on an episode, with a spoiler flag. Show cards show the average.
- Aired archive vs upcoming. The current 16 shows are aired; the schema allows a dated upcoming episode so the schedule is real when one is announced.
- People pages. Hosts and guests, and every episode they sat on.
- Your library on this browser: continue watching, history, watchlist. Not an account.
- A player on the episode page. Cast only when the episode has a file this page can put in a `<video>` element.

Not this version: accounts, follow alerts, ticket links, clip timestamps, comment threads, and a Google Cast receiver that embeds YouTube. Do not download or restream YouTube.

## Architecture

Next.js App Router, TypeScript, plain CSS. Dynamic route `params` are a Promise and must be awaited ([Next.js dynamic routes](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes), docs via Context7 `/websites/nextjs`).

```text
content/catalog.json  →  src/lib/catalog.ts  →  server pages
reviews.sqlite        ←  src/lib/reviews.ts  ←  server pages and the review form
localStorage          ↔  src/lib/library.ts  ↔  episode page and /library
```

- Catalog is compiled JSON. No scraper in the app.
- Reviews use `node:sqlite` `DatabaseSync`. Verified on Node v22.23.1 in this environment. It prints an experimental warning and still opens. One row per viewer per episode. Stars are 1–5. Unknown episode ids are rejected.
- Viewer identity is an httpOnly cookie `pc_viewer` (random id + display name), set when someone submits a review. No passwords.
- Watch history and the watchlist stay in `localStorage` on this browser. The SQLite file is `data/panel-club.sqlite` and is gitignored. Tests use `:memory:`.
- Player: `youtube-nocookie.com/embed/{videoId}` when the episode only has a YouTube id. A `<video>` element when `mediaUrl` is set. Seed data leaves `mediaUrl` empty.
- Cast uses the [Remote Playback API](https://developer.mozilla.org/en-US/docs/Web/API/Remote_Playback_API) (`remote.watchAvailability`, `remote.prompt()`). The [W3C spec](https://www.w3.org/TR/remote-playback/) requires the remote source to be that media element's own source. A YouTube iframe is not one, so those episodes do not show a Cast control. Chrome's desktop backend was aimed at M121 ([blink-dev intent](https://groups.google.com/a/chromium.org/g/blink-dev/c/kJLzOeS-l4w)); the API is not baseline, and there is no device in CI. `src/lib/cast.ts` is a pure decision: `{ kind: "file", available }` can prompt; `{ kind: "youtube" }` cannot.

Server Components may import `reviews.ts`. Client Components must not. Pass the score in as a prop.

## Screens

Wireframe is approved (`docs/design/panel-platform/`). Implementers follow `spec.md` and do not edit it. One floating app bar: Discover, Upcoming, People, Library. It stays put and replaces the page.

1. Directory — search, four category filters, show cards with score and episode count. Empty search state.
2. Show — host, availability note, episode list, score.
3. Episode — player, Cast hidden on YouTube and shown for a file when a device is available, review form, spoiler hidden until asked.
4. Upcoming — empty state in the seed, plus one dated example row, then the aired archive.
5. People — list of hosts and guests. Person — episodes they host, episodes they guest.
6. Library — continue, history, watchlist. Empty state.
7. Not found — unknown show or episode id.

## Slices

Disjoint files. An edge exists only where a later slice imports a file an earlier slice owns. The design bead blocks every UI slice. Catalog, reviews, and library have no page.

| Slice | Owns | Blocked by | Test |
| --- | --- | --- | --- |
| Wireframe | `docs/design/panel-platform/wireframe.html`, `docs/design/panel-platform/notes.md`, `docs/design/panel-platform/spec.md` | — | `test -f` all three |
| Catalog | `content/catalog.json`, `src/lib/catalog.ts`, `src/lib/catalog.test.ts` | — | `node --experimental-strip-types --test src/lib/catalog.test.ts` |
| Reviews | `src/lib/reviews.ts`, `src/lib/reviews.test.ts` | Catalog | `node --experimental-strip-types --test src/lib/reviews.test.ts` |
| Library | `src/lib/library.ts`, `src/lib/library.test.ts` | — | `node --experimental-strip-types --test src/lib/library.test.ts` |
| Directory | `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/not-found.tsx`, `src/app/shows/[slug]/page.tsx`, `src/components/site-header.tsx`, `src/components/show-card.tsx`, `src/components/directory.tsx`, `src/lib/filters.ts`, `src/lib/filters.test.ts` | Wireframe, Catalog, Reviews | `node --experimental-strip-types --test src/lib/filters.test.ts` |
| Schedule | `src/lib/schedule.ts`, `src/lib/schedule.test.ts`, `src/app/upcoming/page.tsx`, `src/components/schedule.tsx` | Wireframe, Catalog | `node --experimental-strip-types --test src/lib/schedule.test.ts` |
| People | `src/lib/people.ts`, `src/lib/people.test.ts`, `src/app/people/page.tsx`, `src/app/people/[slug]/page.tsx` | Wireframe, Catalog | `node --experimental-strip-types --test src/lib/people.test.ts` |
| Episode | `src/lib/cast.ts`, `src/lib/cast.test.ts`, `src/components/player.tsx`, `src/components/cast-button.tsx`, `src/components/review-form.tsx`, `src/app/shows/[slug]/episodes/[id]/page.tsx` | Wireframe, Catalog, Reviews, Library | `node --experimental-strip-types --test src/lib/cast.test.ts` |
| Library page | `src/lib/library-view.ts`, `src/lib/library-view.test.ts`, `src/app/library/page.tsx`, `src/components/library-list.tsx` | Wireframe, Library | `node --experimental-strip-types --test src/lib/library-view.test.ts` |

Header links (Discover, Upcoming, People, Library) are written only in `site-header.tsx`. The bar is fixed and switches the route. Other slices add routes and do not edit the header, `package.json`, or `spec.md`. Every UI slice lists `docs/design/panel-platform/spec.md` so the implementer can read it. That shared path means `/go` keeps one UI slice per wave.

### Symbols

- Catalog: `loadCatalog`, `getShow`, `getEpisode`. Slug from the show name. Episode id is the YouTube `videoId`.
- Reviews: `saveReview`, `listReviews`, `averageScore`. `saveReview` replaces the same viewer's earlier review.
- Library: `recordWatch`, `markFinished`, `toggleSave`, `listLibrary`. Storage is an argument (Map in tests, `localStorage` in the client).
- Filters: `filterShows(catalog, { query, category })`.
- Schedule: `splitSchedule` → `{ upcoming, aired }`. Upcoming sorts by `premieresAt`. Missing date is allowed and sorts last.
- People: `listPeople`, `appearances`. Split `guest` on commas, trim, drop empties. Co-hosts split on ` & `. Do not invent a guest from the title when the field is empty. A host who is also a guest is one person, listed under both hosted and guested appearances.
- Cast: `castDecision({ kind, deviceAvailable })` → `prompt` or `hidden`.
- Library view: `groupLibrary` → continue (started, not finished), history, saved.

### Catalog seed

Transcribe the public directory already rendered at [panel-club.vercel.app](https://panel-club.vercel.app/): 16 shows, the four categories, YouTube ids, durations, guest strings, source URLs, `checkedAt`, `availabilityNote`. Add `status: "aired" | "upcoming"`, optional `premieresAt`, optional `mediaUrl`. Every seeded episode is `aired` with `mediaUrl: null`. Do not copy that site's markup, CSS, or logo.

Catalog test: 16 shows; categories are only those four; India's Got Latent has 7 episodes; every episode has a non-empty `videoId`; a upcoming fixture sorts ahead of undated ones in `splitSchedule`'s own test, not by mutating the seed.

## Locked decisions

- This repo is the product. The Vercel site is a reference, not a codebase to fork.
- Playback of seeded episodes is the YouTube embed. No stream ripping, no proxy, no Cast SDK app id.
- The approved wireframe is the UI contract: floating header, labels and navigation from `spec.md`. Do not invent screens listed there as out of scope.
- A `page.tsx` file exports only the page. A named helper such as `LibraryPage` in that file fails the production typecheck. Keep helpers unexported or move them out of `page.tsx`.
- Cast control renders only for `mediaUrl` episodes when `watchAvailability` says a device is there. YouTube episodes show no Cast button.
- Reviews are public and tied to the `pc_viewer` cookie. History does not sync across browsers.
- `node:sqlite`, not a hosted database. The experimental warning is expected on Node 22.
- Scores on cards come from the server. The directory client island only filters.
- Parts stay separate episodes when the source lists them that way (Madhur Model P-1 / P-2).

## Gotchas

- `node:sqlite` is experimental on Node 22.23.1. Tests still pass. Do not fail the suite on that warning.
- Guest strings are dirty. Empty string is common. Do not invent guests from the title when the field is empty.
- Season gaps are real (India's Got Latent season 1 is not public; Pretty Good Roast Show is missing episode 5). Keep `availabilityNote` on the show page.
- A Next.js client component that imports `reviews.ts` will try to bundle `node:sqlite` and fail.
- Remote Playback cannot see a Chromecast from CI, and it cannot cast an iframe. The cast test uses a fake availability flag.
- `params` must be awaited. Passing the Promise straight into `getShow` returns nothing.
- UI slices that land before the directory slice have route files and no `package.json` yet. Their test is the node test, not `next build`.
- `page.tsx` may export only the page component. Named exports in that file fail the Next.js typecheck.

## Done

- Wireframe exists and a person can open every screen in `spec.md`, including empty upcoming, empty library, Cast hidden, and not found.
- Seeded directory matches the 16-show public catalog, with scores once a review exists.
- An episode plays in the page. A review updates that episode and the show average. A second submit from the same cookie replaces the first.
- Upcoming renders an empty state today and a dated row when `status` is `upcoming`.
- A person page lists host and guest appearances without duplicate names.
- Library records a watch, offers continue, and toggles a save, in this browser only.
- Cast test: file + device → prompt; YouTube → hidden.

## Test

```bash
node --experimental-strip-types --test src/lib/*.test.ts
```

Run that from `~/pers/panel-club` after the slices that own those tests exist. The wireframe slice is `test -f docs/design/panel-platform/wireframe.html && test -f docs/design/panel-platform/notes.md`.
