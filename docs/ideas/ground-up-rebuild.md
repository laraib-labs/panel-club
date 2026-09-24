# Ground-up rebuild (v2)

## Product
A $0 hobby storefront on Vercel that reads one Neon Postgres (separate `production` / `development` branches). Ingest is a versioned Docker image on the existing Contabo VPS. Visitors browse, embed-play, and review without accounts.

## User and moment
Laraib wants the site on free compute after Railway, one database story, a merge that cannot ship a broken `next build`, and ingest that is observable and not a public HTTP job.

## What they do today
App on Railway; catalog dual sqlite/Postgres with `CATALOG_SCHEMA`; ingest CLI + systemd `node --experimental-strip-types`; in-memory review rate limit; `POST /api/jobs/ingest`. `main` can fail `next build`.

## Job to be done
Ship the architecture in `docs/plans/ground-up-rebuild.md`: Postgres-only runtime, Vercel + Neon Free + VPS Docker ingest, Upstash rate limit, CI that blocks bad merges.

## Success
Hobby origin 200s with no card for app/DB. Every public page reads Neon. Reviews rate-limit is shared across instances (Upstash). Over-limit submits stay a silent no-op, same as today. Ingest is `docker pull` + timer + healthchecks.io. No sqlite production path, no schema switch, no public ingest route.

## Constraints
- Repo `laraib-labs/panel-club`. Repo secrets only (not org). `DATABASE_URL` never on GitHub.
- No data migration of Railway sqlite reviews. Reseed Neon `production` from `content/catalog.json`.
- Docker already on the VPS.
- YouTube embed only. No accounts. No admin CMS.
- Comedy-ux public screens stay. No rate-limit UI.
- Unit tests may use sqlite `:memory:` for pure logic. Runtime SQL is Postgres.

## Recommendation
Follow `docs/plans/ground-up-rebuild.md` waves 1–5.

## Smallest version
Neon branches + drop `CATALOG_SCHEMA`. Storefront Postgres-only + GitHub Actions `tsc`/`node --test`/`next build`. Upstash + trusted client IP; blocked submits stay silent. Ingest image on GHCR, VPS pulls `:latest`, healthchecks.io, delete HTTP ingest.

## Not in this version
Accounts, admin CMS, restream/transcode, full-text search, seasons, multi-tenancy, custom domain (open), Sentry (open), org secrets, Railway as the app host, visible rate-limit / rejected-review UI.

## Needs screens
no

## Decision
Vercel Hobby + Neon Free (two branches, two `DATABASE_URL`s) + Contabo Docker ingest. Postgres-only at runtime. Upstash for review rate limits; over-limit is still a silent `return`. GHCR image + systemd `docker pull`. healthchecks.io. Repo-scoped GitHub secrets. No Railway sqlite carry-over. No public ingest HTTP. No new screens.
