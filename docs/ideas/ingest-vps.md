# VPS ingest cron and org secrets

## Product
Panel Club ingest runs on Laraib’s VPS on a timer and writes the shared Neon catalog. Shared keys live as GitHub org secrets for other `laraib-labs` repos; panel-club’s database URL stays repo/VPS-only.

## User and moment
The public Next app should not be the ingest button. Cron on the VPS already fits other pers jobs. YouTube API keys should not be copy-pasted into every repo.

## What they do today
`npm run ingest` writes sqlite. `POST /api/jobs/ingest` is a public route gated by `CRON_SECRET`. Neon is seeded. GitHub org `laraib-labs` has no shared Actions secrets for YouTube.

## Job to be done
Every N minutes, the VPS polls YouTube and upserts Neon. Other pers repos can reuse the YouTube (and Neon API) org secrets in Actions without seeing Panel Club’s `DATABASE_URL`.

## Success
A VPS timer run inserts/updates Neon `panel_club` with no HTTP call to the website. `CRON_SECRET` is unused. `gh secret list --org laraib-labs` shows the shared keys with private visibility.

## Constraints
- Same Neon project, schema `panel_club`.
- No public ingest. Visitors never trigger the job.
- Org secrets are GitHub Actions/org scope — they do **not** auto-sync to the VPS. VPS uses a root-only `EnvironmentFile`.
- `DATABASE_URL` is **not** an org secret (wrong database for other apps).
- Do not restream or scrape watch pages.
- No new UI.

## Recommendation
VPS systemd timer + Postgres ingest CLI. Org secrets: `YOUTUBE_API_KEY`, optional `NEON_API_KEY`. Repo/VPS: `DATABASE_URL`, `CATALOG_SCHEMA`.

## Smallest version
- CLI uses `DATABASE_URL` → Neon.
- systemd unit + timer checked into the repo; install on the existing Contabo VPS.
- `gh secret set --org laraib-labs --visibility private` for shared keys.

## Not in this version
- GitHub Actions as the ingest runner.
- Railway cron.
- Syncing org secrets onto the VPS automatically.
- Admin UI, CRON_SECRET as the production path.

## Needs screens
no

## Decision
Ingest is a VPS cron writing Neon. The website only reads. Shared YouTube (and Neon control-plane) keys are GitHub org secrets for `laraib-labs` private repos. Panel Club `DATABASE_URL` stays off the org secret list.
