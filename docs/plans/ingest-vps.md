# VPS ingest and repo secrets

Run Panel Club YouTube ingest on the existing Contabo VPS so it writes the shared Neon database. `YOUTUBE_API_KEY` is a GitHub **repository** secret on `laraib-labs/panel-club`. Keep `DATABASE_URL` off GitHub.

Locked from `docs/ideas/ingest-vps.md` (Decision filled). Continues `docs/plans/neon-catalog.md` (data plane). Does not reopen comedy-ux.

Citations: `gh secret set --org` + `--visibility private` ([GitHub CLI](https://cli.github.com/manual/gh_secret_set)); Node 22 already required by `package.json` `engines`.

## What / why

`npm run ingest` still opens sqlite. The hosted Next route needs `CRON_SECRET` because it is on the public internet. Laraib already runs pers timers on Contabo (`deal-hunter`, `iphone17-alert`). Neon is the catalog. The job should live next to those timers, not on the website.

Repo Actions can read `YOUTUBE_API_KEY`. That secret does not appear on the VPS by magic. Other `laraib-labs` repos do not inherit it.

## Architecture

```text
Contabo systemd timer
  EnvironmentFile=/etc/panel-club.env   # DATABASE_URL, CATALOG_SCHEMA, YOUTUBE_API_KEY
  WorkingDirectory=/opt/panel-club      # git clone, Node 22
  ExecStart=node --experimental-strip-types src/platform/ingest/cli.ts
       │
       ▼
  Neon panel_club schema  ←  same DATABASE_URL as the Next app (read path)

laraib-labs/panel-club repo secrets (Actions)
  YOUTUBE_API_KEY
  # DATABASE_URL is not a GitHub secret
```

Leave `POST /api/jobs/ingest` in the tree but unused in production (or 410 later). No `CRON_SECRET` on the VPS path.

## Files / symbols

| Slice | Owns | Blocked by | Test |
| --- | --- | --- | --- |
| Postgres ingest CLI | `src/platform/ingest/cli.ts`, `src/platform/ingest/run-pg.ts` (or pg helpers next to `catalog-db.ts`), `src/platform/ingest/cli.test.ts` | — | `node --experimental-strip-types --test src/platform/ingest/cli.test.ts src/platform/ingest.test.ts` |
| VPS timer | `ops/panel-club-ingest.service`, `ops/panel-club-ingest.timer`, `ops/install-ingest-vps.sh`, `ops/panel-club.env.example` | Postgres ingest CLI | `test -f ops/panel-club-ingest.timer && grep -q EnvironmentFile ops/panel-club-ingest.service` |
| Repo secrets | (gh; no product files) | — | `gh secret list --repo laraib-labs/panel-club` includes `YOUTUBE_API_KEY` |

No design bead. No `player.tsx` / `globals.css`. Do not put real secrets in git.

Symbols: `runIngest` against `pg.Pool` when `DATABASE_URL` is set; `CATALOG_SCHEMA=panel_club`; timer `OnCalendar=*:0/30` (every 30 minutes) unless Laraib picks another cadence at install.

`gh` (org secrets slice), confirm in `/go` before writing secrets. Values come from stdin / existing local `.env`, never from the plan file.

## Locked decisions

Copied from the idea file; do not reopen.

- **Product:** VPS timer writes Neon; `YOUTUBE_API_KEY` is a **repo** secret; `DATABASE_URL` stays local/VPS-only. No org secrets.
- **Success:** Timer run updates `panel_club` with no website POST. Repo secret list shows `YOUTUBE_API_KEY`.
- **Constraints:** Same Neon schema. No public ingest. Repo secrets ≠ VPS env. No restream/scrape. No new UI.
- **Smallest version:** CLI→Neon; systemd unit+timer; `gh secret set --repo laraib-labs/panel-club`.
- **Not in this version:** Actions-as-cron, Railway cron, auto-sync secrets to VPS, CRON_SECRET as the prod path, GitHub org secrets.

## Gotchas

- GitHub repo secrets are for Actions. systemd `EnvironmentFile=/etc/panel-club.env` mode `600`, owned by root. Copy `YOUTUBE_API_KEY` there once by hand (or `scp`).
- Neon **pooler** URLs can stall long transactions; ingest CLI should use the **direct** (non-`-pooler`) host, same lesson as seed.
- Clone on the VPS must be Node **22** (`engines`). `--experimental-strip-types` matches local.
- Do not commit `.env`. `ops/panel-club.env.example` lists names only.
- Do not `gh secret set --org`. Repo only.

## Done

- With `DATABASE_URL` set, `ingest/cli.ts` upserts Postgres (unit test with mocked YouTube + mocked/fake pg or sqlite-compat path still green).
- Unit files exist; install script is idempotent (`systemctl enable --now panel-club-ingest.timer`).
- `YOUTUBE_API_KEY` listed on the **repo**. `DATABASE_URL` is not a GitHub secret.
