# Local infra + full frontend redesign

Extends `docs/plans/ui-rebuild.md` (Phases 3–4) and stays inside `ground-up-rebuild.md`'s
locked data-layer decisions. Scope: local environment only — Cursor handles the actual
Neon/Vercel/Upstash cutover later. Every local piece here is built so that cutover is an
env-var change, not a code change.

## Design direction: locked

**A+C hybrid** (picked over pure A, pure C, and editorial B): dark, cinematic surfaces —
big cover art, hero treatment on show/episode pages — combined with Letterboxd's
restraint everywhere else: one confident accent color, type-driven hierarchy over heavy
chrome, star ratings and spoiler chips as first-class UI, no Netflix-style auto-carousels
or badge-dense cards. Directory/grid views stay calm and content-forward; hero moments
(show cover, episode player) get the cinematic treatment.

## Part 1 — Local infrastructure

### Postgres

`docker-compose.yml` at repo root, real `postgres:16-alpine` (same image family CI already
uses). This becomes the canonical local path; the PGlite bridge (`scripts/dev.ts`,
Phase 0) stays as a no-Docker fallback for environments like this sandbox, not deleted.

### Redis (Upstash-compatible, zero code difference from prod)

Upstash's own documented local-dev pattern
([upstash.com/docs/redis/sdks/ts/developing](https://upstash.com/docs/redis/sdks/ts/developing)):
a real Redis plus their `hiett/serverless-redis-http` proxy, which speaks the exact REST
protocol `@upstash/redis` expects. `UPSTASH_REDIS_REST_URL=http://localhost:8079` locally,
`https://*.upstash.io` in prod — same client code, same `review-rate-limit.ts`, zero
branching. This is *why* Phase 2's Upstash-or-fail fix matters: local dev now exercises
the real code path instead of the always-allow fallback.

### Schema fix: drop `panel_club.` qualification, not add it everywhere

Found while building this: `catalog.ts` / `reviews-pg.ts` read with explicit
`panel_club.*` qualification (latest commit, `8da71f1`), but `catalog-ingest-pg.ts`'s
writes are unqualified — the exact bug Phase 0 caught empirically. Two ways to fix it:
qualify the writes too, or unqualify the reads. **Unqualify the reads**, because
`ground-up-rebuild.md` already locked the target design as *two Neon branches, not
`SET search_path`* — environment isolation by which `DATABASE_URL` you hold, not by
schema name. Plain `public` schema, no qualification anywhere, is the locked end state;
qualifying everything to `panel_club` would work today but contradicts that lock and
re-creates the same class of bug the lock exists to prevent. `docs/sql/migrations/001_init.sql`
drops its `CREATE SCHEMA panel_club[_test]` statements accordingly.

### Missing indexes (real gap, not part of the lock)

`episodes(show_slug)`, `reviews(episode_id)`, `episode_credits(person_slug)` — table
shape stays exactly as `ground-up-rebuild.md` locked it "genuinely sound."

### Gotcha found while building this

`@upstash/ratelimit` 2.1.0+ adds a Lua script shebang flag (`allow-key-locking`) that is
an Upstash-proprietary Redis extension — no self-hosted Redis, including the newest OSS
release (7.4.11, tested), understands it, and `serverless-redis-http` has no released fix
([hiett/serverless-redis-http#40](https://github.com/hiett/serverless-redis-http/issues/40)).
Pinned `@upstash/ratelimit` to `2.0.8` (last pre-2.1.0 release) in `package.json` — same
version for local and prod, not an environment branch. The flag was purely a locking
performance optimization; its absence falls back to the previous (identical-correctness)
global-lock behavior, which doesn't matter at this traffic level.

### Local env

`.env.local` (gitignored, already covered by `.gitignore`) holds:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
UPSTASH_REDIS_REST_URL=http://localhost:8079
UPSTASH_REDIS_REST_TOKEN=local_dev_token
```
Production swaps only these three values (plus `REVALIDATE_SECRET`/`REVALIDATE_URL` from
Phase 1) — no code changes, per the ask.

## Part 2 — Design system

- **Tailwind v4**, CSS-first `@theme` config. Replaces the 743-line ad-hoc `globals.css`,
  not layered on top of it.
- **Tokens**: near-black surface ramp (2–3 elevation steps), one accent color (warm,
  distinct from the generic Netflix red — candidate: amber/coral), a type scale with one
  display weight for titles and one text weight for body/meta, consistent radii, and a
  small motion-duration/easing scale shared with Phase 4.
- **Motion**: `motion` library (already decided in `ui-rebuild.md` Phase 4) — shared-element
  thumbnail→hero transition, staggered grid entrance, filter crossfade, all behind
  `prefers-reduced-motion`.

## Part 3 — Component-by-component

Every component gets rebuilt against tokens, not just restyled in place:

| Component | A+C treatment |
| --- | --- |
| `site-header` | Minimal floating bar stays; restrained active-state underline, not a filled pill |
| `directory` + `show-card` | Calm grid, no badge clutter — score as a quiet corner mark, not a loud sticker |
| `show-card` hero (show page cover) | Cinematic: full-bleed cover art, gradient scrim for title legibility |
| `player` | Unchanged mechanics (YouTube embed / file), restyled chrome around it |
| `review-form` / `review-card` | Letterboxd-style star input, spoiler as a subtle chip not a warning box |
| `schedule` (Upcoming) | Editorial list rhythm — dated rows lead, undated aired archive recedes |
| `people-list` / `person page` | Monogram avatars get the accent-color treatment; grid stays quiet |
| `library-list` | Continue/History/Watchlist as three restrained sections, not cards-on-cards |
| `not-found` | Matches the rest — currently an afterthought |

## Execution order

1. Local infra (docker-compose, schema fix, indexes, `.env.local`) — verify end to end
   before any visual work starts, since every subsequent screenshot needs real data.
2. Tokens + Tailwind config — no component changes yet, just the system.
3. Components, in the table's order (header first since every page depends on it).
4. Motion pass, once every component exists in its final visual form.
5. Full regression: `tsc`, full test suite, `next build`, browser walk of every screen.

## Success criteria

- `docker compose up` brings up Postgres + Redis + SRH; `npm run db:migrate && npm run
  db:seed` succeeds against it; `npm run dev` (plain, no PGlite wrapper) serves real data.
- A review submitted locally is actually rate-limited after 5/minute — proving the real
  Upstash code path runs locally, not the always-allow fallback.
- `npx tsc --noEmit` clean, full test suite green, `npx next build` clean throughout.
- Every screen in `docs/design/panel-platform/spec.md` (soon superseded per `ui-rebuild.md`
  Phase 3) walked in a real browser, both empty and populated states.
