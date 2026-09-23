# Railway host

Put Panel Club on a public Railway URL. Same product as `docs/plans/panel-platform.md`: Next.js, catalog JSON, `node:sqlite` reviews, browser `localStorage` library. Not a rewrite.

Citations: Railway Next.js deploy ([guide](https://github.com/railwayapp/docs/blob/main/content/guides/nextjs.md)), `next start --port ${PORT-3000}` ([failed-to-respond](https://github.com/railwayapp/docs/blob/main/content/docs/networking/troubleshooting/application-failed-to-respond.md)), volumes ephemeral without a mount, `railway volume add --mount-path /data` ([CLI volume](https://github.com/railwayapp/docs/blob/main/content/docs/cli/volume.md)), `railway.json` `startCommand` + `healthcheckPath` ([schema example](https://github.com/railwayapp/docs/blob/main/content/guides/jupyter-server-team.md)), `RAILWAY_VOLUME_MOUNT_PATH` when a volume is attached.

## What / why

The app only runs on localhost. Reviews live in `data/panel-club.sqlite` (gitignored). The container disk is wiped on every deploy unless a volume is mounted. Hosting means: Node 22 (required for `node:sqlite`), bind Railway’s `PORT`, persist sqlite on a volume, generate a public domain.

GitHub `origin` is the source. Railway ship connects that repo (not a one-off `railway up` with no remote).

## Architecture

```text
Railpack/Nixpacks  →  next build  →  next start --port $PORT
                     ▲
                     └── volume /data  →  panel-club.sqlite
content/catalog.json baked into the image
```

- One web service, **one replica**. sqlite + a volume cannot be shared across replicas.
- Reviews path: `join(process.env.RAILWAY_VOLUME_MOUNT_PATH ?? join(process.cwd(), "data"), "panel-club.sqlite")`. Local stays `./data/`. On Railway, mount `/data` so the env var is `/data`.
- Do not open sqlite via `import.meta.url` relative hops (episode page does this today). That path is wrong after `next build`.
- One `openReviewsDb()` used by Discover, show, and episode pages. Client components still must not import `reviews.ts`.
- Catalog JSON and the Next build output stay on the image. Only sqlite goes on the volume. Writes during build/pre-deploy to `/data` do not persist (volume mounts at container start).
- Library/watchlist stay in `localStorage`. They will not follow the user across devices. That is already locked.

## Files / symbols

| Slice | Owns | Blocked by | Test |
| --- | --- | --- | --- |
| SQLite path | `src/lib/reviews-db.ts`, `src/lib/reviews-db.test.ts`, `src/app/page.tsx`, `src/app/shows/[slug]/page.tsx`, `src/app/shows/[slug]/episodes/[id]/page.tsx` | — | `node --experimental-strip-types --test src/lib/reviews-db.test.ts` |
| Runtime config | `package.json`, `railway.json`, `.railwayignore` | — | `test -f railway.json && node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')).engines.node.includes('22')"` |
| Railway ship | (CLI: project, volume `/data`, domain) | SQLite path, Runtime config | `curl -sfI "$PANEL_CLUB_URL/"` after domain exists |

Symbols: `reviewsDbPath()`, `openReviewsDb()`. `reviews.ts` stays schema + save/list/average.

`.railwayignore` excludes `node_modules`, `.next`, `data/*.sqlite`, `tsconfig.tsbuildinfo`.

`package.json`: `"engines": { "node": ">=22" }`. Keep `"start": "next start"`. `railway.json` sets `deploy.startCommand` to `next start --port ${PORT-3000}` and `deploy.healthcheckPath` to `/`. `restartPolicyType`: `ON_FAILURE`. Do not set `numReplicas` above 1.

`railway.json` does not attach the volume; `/go` does `railway volume add --mount-path /data` on the web service after the first deploy exists, then redeploy. Confirm with the user before creating the project, attaching the volume, generating a domain, or `accept-deploy`.

## Locked decisions

- Railway, not Vercel. Vercel’s Node filesystem is the wrong place for `DatabaseSync`.
- Keep `node:sqlite`. Do not add Postgres, Neon, or Railway Postgres for this version.
- Node 22+. The experimental sqlite warning is expected.
- One replica. No multi-region.
- No accounts, no Cast SDK, no restreaming YouTube — unchanged from the platform plan.
- No new product screens. No design bead.
- Do not `git init` at `~/pers`. Git writes only inside `panel-club`.
- GitHub `origin` is the source of truth. Railway ship connects `main` on that repo.
- Include the dark skin (`globals.css`, `layout.tsx`, `site-header.tsx`) so production is not the old grayscale CSS.
- `/go` may use the Railway plugin because this plan names deploy. Confirm before create/delete/accept-deploy.

## Gotchas

- Episode sqlite path via `import.meta.url` will miss the volume after compile. Centralize the path first.
- Volume is empty on first boot. `mkdir` + `initReviewsSchema` still required.
- Hobby sleep is fine; the volume keeps sqlite. Reviews from before the volume existed on ephemeral disk are gone.
- `railway up` still works as a fallback, but the intended path is a GitHub-connected Railway service on `main`.
- `node:sqlite` is not available on Node 20. If Railpack picks 20, the build or boot fails. Pin via `engines`.
- Do not commit `data/*.sqlite` or `tsconfig.tsbuildinfo`.

## Done

- `https://<generated>.up.railway.app/` (or custom domain later) serves Discover.
- Submitting a review, redeploying, then loading the show still shows that review (volume).
- Local `next dev` still writes `./data/panel-club.sqlite`.
- `node --experimental-strip-types --test src/lib/*.test.ts` still passes.

## Test

```bash
node --experimental-strip-types --test src/lib/*.test.ts
```

After ship: `curl -sfI` the public origin, then one review round-trip and a redeploy.

## Not this version

Custom domain, CDN, Postgres, multiple environments, preview PRs. GitHub-connected deploys are in this version.
