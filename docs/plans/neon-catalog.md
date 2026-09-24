# Neon catalog and ingest

Make Panel Club’s catalog and reviews a real backend: one Neon database, numbered migrations, automated YouTube poll. Public screens stay; they read Postgres instead of `catalog.json`.

Locked from `docs/ideas/neon-backend.md` (Decision filled). ERD: `docs/design/platform/schema.md`. Supersedes `docs/plans/catalog-ingest.md` (sqlite-only, skip-only ingest, pages still on JSON).

Citations: YouTube Data API `playlistItems.list`, `videos.list` (`snippet`, `contentDetails`, `status`, `liveStreamingDetails`; `liveBroadcastContent` upcoming/live/none) ([v3 videos](https://developers.google.com/youtube/v3/docs/videos)); Atom `feeds/videos.xml?playlist_id=` / `channel_id=`; `pg.Pool` + `onConnect` `SET search_path` ([node-postgres](https://github.com/brianc/node-postgres)).

## What / why

A new Latent episode or a scheduled premiere only hits the site after a JSON edit and a deploy. Reviews live in a second sqlite file. That is not a platform. Neon holds shows, credits, episodes, reviews, and ingest audit. Cron writes; visitors read.

## Architecture

```text
content/catalog.json     →  db:seed (once)
content/ingest-rules.json →  sources.title_include / min_duration

cron POST /api/jobs/ingest
  → YouTube API (or RSS if no key / playlist)
  → upsert episodes + episode_credits
  → unpublished / cover_video_id
  → schema panel_club | panel_club_test

Next RSC  →  same Pool  →  catalog + reviews
player.tsx →  youtube-nocookie embed (unchanged)
library    →  localStorage (unchanged)
```

**Schemas.** `CATALOG_SCHEMA` default `panel_club` when `NODE_ENV=production`, else `panel_club_test`. Pool `onConnect`: `SET search_path TO <schema>, public`.

**Migrations.** `docs/sql/migrations/001_init.sql` (and later numbered files). Table `schema_migrations`. Runner `src/platform/migrate.ts`. Same DDL mirrored in sqlite for unit tests (`SQLITE_CATALOG_DDL`).

**Ingest.** Latest page (15–25). `ON CONFLICT (youtube_video_id)` updates title, duration, status, premieres_at, unpublished, credits. Credits: `parseFeaturedGuests(title)` else description (`ft.` / `Guests:`). Channel sources require `title_include`. `liveBroadcastContent=upcoming` or future `scheduledStartTime` → `status=upcoming`, `premieres_at` set. `privacyStatus` private or id missing from `videos.list` → `unpublished`. Newest public aired episode refreshes `shows.cover_video_id`. Existing seed history is not re-crawled in full.

**Read.** `catalogToView` joins `show_credits` / `episode_credits` back into the in-memory `Catalog` shape so `people.ts`, `schedule.ts`, and pages keep their types. `splitSchedule` already sorts upcoming by `premieresAt`.

**Reviews.** Same `reviews` table as today (roots + `parent_id`), FK to `episodes.id`. `openReviewsDb` / save/list use Postgres when `DATABASE_URL` is set. Unit tests keep `DatabaseSync` `:memory:` / temp sqlite via existing `reviews.ts` helpers.

App **requires** `DATABASE_URL` outside `node:test`. No JSON fallback at runtime.

## Files / symbols

| Slice | Owns | Blocked by | Test |
| --- | --- | --- | --- |
| Migrations | `package.json`, `docs/sql/migrations/001_init.sql`, `docs/sql/catalog.sql`, `src/platform/schema.ts`, `src/platform/migrate.ts`, `src/platform/migrate.test.ts` | — | `node --experimental-strip-types --test src/platform/migrate.test.ts` |
| Catalog store | `src/platform/catalog-db.ts`, `src/platform/pg.ts`, `src/platform/seed.ts`, `content/ingest-rules.json` | Migrations | `node --experimental-strip-types --test src/platform/ingest.test.ts` (seed/round-trip cases) |
| Ingest | `src/platform/youtube/source-url.ts`, `src/platform/youtube/duration.ts`, `src/platform/youtube/title-credits.ts`, `src/platform/youtube/client.ts`, `src/platform/youtube/youtube.test.ts`, `src/platform/ingest/run.ts`, `src/platform/ingest/cli.ts`, `src/app/api/jobs/ingest/route.ts`, `src/platform/ingest.test.ts` | Catalog store | `node --experimental-strip-types --test src/platform/youtube/youtube.test.ts src/platform/ingest.test.ts` |
| Reviews on Neon | `src/lib/reviews.ts`, `src/lib/reviews.test.ts`, `src/lib/reviews-db.ts`, `src/lib/reviews-db.test.ts` | Migrations | `node --experimental-strip-types --test src/lib/reviews.test.ts src/lib/reviews-db.test.ts` |
| Live read | `src/lib/catalog.ts`, `src/lib/catalog.test.ts`, `src/app/page.tsx`, `src/app/upcoming/page.tsx`, `src/app/library/page.tsx`, `src/app/people/page.tsx`, `src/app/people/[slug]/page.tsx`, `src/app/shows/[slug]/page.tsx`, `src/app/shows/[slug]/episodes/[id]/page.tsx` | Catalog store, Reviews on Neon | `node --experimental-strip-types --test src/lib/catalog.test.ts src/lib/schedule.test.ts src/lib/people.test.ts` |

No design bead. No new screens. Do not edit `player.tsx` or `globals.css`.

Symbols: `catalogSchemaName()`, `migrate()`, `seedCatalog()`, `catalogToView()`, `parseFeaturedGuests()`, `parseCredits(title, description)`, `runIngest()`, `upsertEpisode()`, `Pool` + `search_path`.

`pg` is added on the Migrations slice (`package.json` only there).

## Locked decisions

Copied from the idea file; do not reopen.

- **Product:** Public comedy-panel library; catalog and reviews live in Neon so a new episode is data, not a git edit.
- **Success:** After ingest (or seed), an episode is reachable with no `catalog.json` change and no data deploy. Premieres show on Upcoming. Next episode is the same path.
- **Constraints:** One Neon project, one `DATABASE_URL`. No accounts. YouTube embed only. Production does not read `catalog.json`. Visitors never create shows.
- **Smallest version:** Migrations; nine tables + unpublished; seed once; cron upsert ingest (API/RSS, description credits, premieres, unpublished, cover); pages and reviews on that database.
- **Not in this version:** Transcode; admin CMS; new public screens; seasons; library-in-DB; restream/scrape; multi-tenant.

Also from brainstorm: best-effort credits; skip-only ingest is out; Upcoming is YouTube `scheduledStartTime` / `liveBroadcastContent=upcoming`.

## Gotchas

- `SET search_path` on every pooled client (`onConnect`), not only at process start.
- Unique `youtube_video_id` allows multiple NULLs (upcoming without an id); aired rows must have an id (`id` = youtube id for stable URLs).
- `reviews` FK to `episodes.id` — seed episodes before any review test that uses Postgres.
- `openReviewsDb` must not `DROP TABLE` on request (already true on the ensure path).
- Channel `@handle` list needs `YOUTUBE_API_KEY`; playlist RSS works without it and will not see premieres as reliably as `videos.list`.
- Quota: `videos.list` in batches of 50 for enrich + unpublished check.
- Railway/Vercel: confirm before attaching `DATABASE_URL` or cron. This plan names the env vars; it does not create the Neon project in `/go` unless Laraib confirms.

## Done

- `001_init` applies on a test schema; sqlite mirror creates the same nine tables.
- Seed loads 16 shows, `show_credits` hosts, `episode_credits` guests.
- Ingest inserts a new matching video, updates title on the same id, skips chess vs LATENT, maps a premiere to `upcoming`, sets unpublished when the API omits the id.
- Discover / Upcoming / episode review thread run against the DB in app code paths (`DATABASE_URL`).
- No `loadCatalog()` disk read in `src/app/**`.
