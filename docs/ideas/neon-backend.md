# Neon backend for Panel Club

## Product
Panel Club stays a public comedy-panel library (browse, play, people, reviews); the catalog and reviews live in Neon so a new episode is saved as data, not as a git edit.

## User and moment
Laraib has a new episode on YouTube and wants it on the site the same day. A visitor should see it in Discover/Library/People without anyone opening `catalog.json`. Today that file is the whole backend; in production that means a deploy per episode.

## What they do today
Shows, episodes, hosts, guests, and upcoming rows live in `content/catalog.json`. The Next app reads that file from disk. Adding an episode means edit JSON, commit, rebuild/redeploy. People are derived from those rows at read time. Reviews already look like a database (SQLite-shaped), not like the catalog. That split does not survive production: git is not a CMS, and a JSON file on the server is not how you ingest content.

## Job to be done
When a recording exists on YouTube, put the show/episode/cast live once, and have every public surface read that record until it is changed or unpublished.

## Success
After one insert (show if new, episode, appearances), the episode is reachable on the public site with no change to `catalog.json` and no deploy for data. The next episode is the same path, not a second copy of the JSON.

## Constraints
- **Neon** is the database (Postgres). One project, one `DATABASE_URL`.
- Public site stays **no accounts**. Reviews keep the existing cookie/viewer model unless a later idea changes that.
- Video stays **YouTube** (id + embed). Do not host/transcode files in this version.
- Do not keep two sources of truth. After cutover, production does not read `catalog.json`.
- Operator write access is **not** public. Visitors never create shows.
- Comedy UX and current public screens stay; this idea is the data plane, not a restyle.

## Recommendation
**Postgres in Neon is the catalog. Git is code. YouTube is the tape.**

Four tables are enough:

1. `shows` — slug, title, cover video id, sort/upcoming flags.
2. `episodes` — id, show id, title, YouTube `video_id`, date, duration, unpublished flag.
3. `people` — slug, name. Created when first credited, not scraped.
4. `appearances` — episode + person + role (host/guest). This is how People pages stay correct when a new episode lands.

Reviews (and replies) move into the **same** Neon database so there is one backup, one connection, one production story.

**Write path (how a new episode actually goes live):** Laraib (or whoever holds the operator secret) uses a **tiny admin** on the same Next app: pick or create show → paste YouTube id + title + date → tick hosts/guests (create person if missing) → publish. That hits server actions that `INSERT` into Neon. No JSON. No PR. A deploy is only for app/code changes.

**Read path:** Server components query Neon. Client components get props or a JSON API that does not import `node:fs`. `catalog.json` is used once as a **seed/migration**, then retired from runtime.

**Local/dev:** same schema against a Neon branch or a local Postgres URL. Seed script loads the current JSON so the site is not empty.

This is ordinary software: durable store, explicit ingest, read models for public pages. It is not a content pipeline, not a DAM, not an auto-scraper. Someone still types who was on the panel; the system stops pretending a committed file is that someone.

## Alternative that loses and why
Keep `catalog.json` in git and “just be careful in production.” Every new episode is a code review and a release. Two environments drift. People/appearances stay a parse of a blob. Reviews already refused this model; the catalog should too.

A YouTube-only sync (poll the channel, invent episodes) loses because credits, slugs, and “is this actually ours” still need a human. You would still build the tables. Skip the scraper.

## Smallest version
- Numbered SQL migrations on one Neon database (schemas `panel_club` / `panel_club_test`).
- Nine tables from `docs/design/platform/schema.md` plus `episodes.unpublished`.
- Seed once from `catalog.json`. Runtime never reads that file.
- Cron ingest: YouTube Data API + Atom RSS; upsert; title then description credits; premieres → upcoming; private/missing → unpublished; newest aired cover.
- Public pages and reviews read/write the same Neon database.
- `DATABASE_URL` + `CATALOG_SCHEMA` + `CRON_SECRET` + `YOUTUBE_API_KEY`.

## Not in this version
- Uploading or transcoding video.
- Operator admin / public CMS / accounts.
- New public screens (Discover / Upcoming / People / episode stay).
- Seasons table, library-in-DB, search engine.
- Restream, watch-page scrape, `yt-dlp`.
- Multi-tenant.

## Needs screens
no (public screens already exist; no admin)

## Decision
Ship the data plane, not an admin CMS. Postgres on Neon is the only runtime catalog and the only reviews store. Git is code. YouTube is the tape (official Data API + playlist/channel Atom RSS; embed playback). Cron polls sources, upserts episodes, parses guests from title then description, maps scheduled premieres to Upcoming, marks taken-down unpublished. No human in the loop after a show is bound to a source. No JSON cutover: seed then stop reading `catalog.json`. Unit tests use sqlite `:memory:` with the same table names. Do not add frontend screens in this work.
