# VPS ingest cron and repo secrets

## Product
Panel Club ingest runs on Laraib’s VPS on a timer and writes the shared Neon catalog. `YOUTUBE_API_KEY` is a GitHub **repo** secret on `laraib-labs/panel-club` (from local `.env`). `DATABASE_URL` stays local/VPS-only.

## User and moment
The public Next app should not be the ingest button. Cron on the VPS already fits other pers jobs. Actions on this repo need `YOUTUBE_API_KEY` without checking `.env` into git.

## What they do today
`npm run ingest` writes sqlite unless `DATABASE_URL` is set. `POST /api/jobs/ingest` is unused in production. Neon is seeded. `YOUTUBE_API_KEY` lives in local `.env`.

## Job to be done
Every N minutes, the VPS polls YouTube and upserts Neon. Actions on this repo can use `YOUTUBE_API_KEY` as a repository secret. Other repos do not inherit it.

## Success
A VPS timer run inserts/updates Neon `panel_club` with no HTTP call to the website. `CRON_SECRET` is unused. `gh secret list --repo laraib-labs/panel-club` shows `YOUTUBE_API_KEY` and not `DATABASE_URL`.

## Constraints
- Same Neon project, schema `panel_club`.
- No public ingest. Visitors never trigger the job.
- Repo secrets are GitHub Actions scope — they do **not** auto-sync to the VPS. VPS uses a root-only `EnvironmentFile`.
- No GitHub **org** secrets for this project.
- `DATABASE_URL` is **not** a GitHub secret.
- Do not restream or scrape watch pages.
- No new UI.

## Recommendation
VPS systemd timer + Postgres ingest CLI. Repo secret: `YOUTUBE_API_KEY`. VPS/local only: `DATABASE_URL`, `CATALOG_SCHEMA`.

## Smallest version
- CLI uses `DATABASE_URL` → Neon.
- systemd unit + timer checked into the repo; install on the existing Contabo VPS.
- `gh secret set YOUTUBE_API_KEY --repo laraib-labs/panel-club` from local `.env`.

## Not in this version
- GitHub Actions as the ingest runner.
- Railway cron.
- Syncing org secrets onto the VPS automatically.
- Admin UI, CRON_SECRET as the production path.

## Needs screens
no

## Decision
Ingest is a VPS cron writing Neon. The website only reads. `YOUTUBE_API_KEY` is a GitHub **repository** secret on panel-club, not an organization secret. `DATABASE_URL` stays off GitHub.
