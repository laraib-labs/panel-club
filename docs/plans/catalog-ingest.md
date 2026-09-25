# Catalog ingest

**Superseded by** `docs/plans/neon-catalog.md`. Do not `/go` this file.

Replace git-as-CMS with an automated YouTube poll into a schema-isolated catalog store. Public playback stays the official embed. Spec for the data plane in `docs/design/platform/architecture.md`.

Citations: YouTube Data API `playlistItems.list` / `videos.list` / `channels.list` ([v3](https://developers.google.com/youtube/v3)); public Atom feeds `feeds/videos.xml?playlist_id=` / `channel_id=`.

## What / why

New episodes only appear after someone edits `catalog.json` and deploys. That is not a platform. We poll each show’s playlist or channel, upsert rows, and leave the player on YouTube.

## Architecture

```text
cron → /api/jobs/ingest → YouTube API or RSS → sqlite/Postgres catalog
content/catalog.json  → seed once
content/ingest-rules.json → title/duration gates
```

`CATALOG_SCHEMA=panel_club` production, `panel_club_test` everywhere else (Postgres). Tests use `:memory:` sqlite.

## Files / symbols

| Slice | Owns | Test |
| --- | --- | --- |
| Platform ingest | `src/platform/**`, `docs/sql/catalog.sql`, `content/ingest-rules.json`, `src/app/api/jobs/ingest/route.ts` | `node --experimental-strip-types --test src/platform/**/*.test.ts` |

Symbols: `parseSourceUrl`, `parseFeaturedGuests`, `iso8601DurationToSeconds`, `listLatestVideos`, `runIngest`, `openCatalogDb`, `catalogToView`.

## Locked decisions

- Official Data API + Atom RSS only. No watch-page scrape, no restream, no `yt-dlp`.
- Embed remains `youtube-nocookie.com`. Ingest does not change `player.tsx`.
- Idempotent on `video_id`. Latest page only (15), not full channel history (seed JSON already has history).
- Channel sources require `titleInclude` from ingest-rules or they skip.
- No accounts. No public write of shows.

## Not in this version

- Switching every page off `loadCatalog()` JSON (next slice: `catalogToView` on sqlite).
- Postgres `pg` driver (DDL is written; runtime is sqlite until Neon is wired).
- Encoding, HLS, Cast for YouTube, moderation UI.
