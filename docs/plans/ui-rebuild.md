# Panel Club — full rebuild

Status: **draft, needs approval on Phase 3's design doc before component work starts.**

## Decisions locked

| Decision | Choice | Date |
| --- | --- | --- |
| Scope | Full rewrite, including the data layer | 2026-09-25 |
| Styling | Tailwind (v4, CSS-first config) | 2026-09-25 |
| Motion | A JS animation library — recommending `motion` (MIT) | 2026-09-25 |
| Wireframe lock | Lifted. `spec.md` superseded by a new design contract | 2026-09-25 |
| **Data layer** | **`docs/plans/ground-up-rebuild.md` governs, verbatim** — see below | 2026-09-25 |
| Canonical repo | `laraib-labs/panel-club`. Local `origin` repointed there (was `laraib-sidd/panel-club`, same commit, stale URL only) | 2026-09-25 |

Do not reopen these during implementation.

### Relationship to `docs/plans/ground-up-rebuild.md`

That document already exists, is more specific than anything below on the data layer and hosting,
is partly implemented already (`ops/panel-club-ingest.service`, `.github/workflows/ingest-image.yml`,
`docs/ops/ingest-runbook.md` all exist), and carries its own **"Locked decisions" section marked "do
not reopen."** This plan does not re-litigate it. Where the two would have conflicted — schema
design, ORM choice, test strategy — this plan now simply points at that document instead of
duplicating or overriding it. This plan owns exactly three things `ground-up-rebuild.md` doesn't
touch: **the immediate rendering-speed fix (Phase 1), the visual/UX rebuild (Phase 3), and motion
(Phase 4)** — plus a local dev bridge (Phase 0) that either plan needs regardless of which one ships
first.

---

## Why

Two complaints: the site is slow, and it looks and feels unfinished. They have different causes,
and the diagnosis matters because it determines the order of work.

**The slowness is not a design problem, and it is not in the UI code.** It is a rendering-strategy
and data-access problem, entirely server-side. Measured on the current tree: `tsc` clean, 101/101
unit tests pass, `next build` succeeds, First Load JS is 103–109 kB. The client bundle is small and
is *not* the bottleneck.

### Root causes, in order of how much they hurt

1. **Every route is `force-dynamic`.** All seven pages opt out of static generation *and* the full
   route cache. Nothing is ever cached. Every visit is a cold server render plus live queries.
2. **Neon free tier scales to zero after ~5 min idle.** Most visits pay a multi-second database
   wake, and because of (1) there is no cached page in front of it.
3. **Every page loads the entire catalog.** `loadAppCatalog()` issues five queries —
   `SELECT * FROM shows`, `SELECT * FROM episodes` (all **323** rows), all sources, all host
   credits, all guest credits. The episode page needs *one* episode and fetches 323.
4. **The 60 s cache cannot work on Vercel.** `catalogCache` (`src/lib/catalog.ts:37`) is a
   module-level variable. Each serverless instance has its own memory, so on a quiet site the hit
   rate is near zero. `ground-up-rebuild.md` confirms Vercel as the host, which makes this
   definitively broken by design, not just fragile.
5. **Sequential round-trip waves.** Home: catalog → *then* scores. Episode: catalog → threads →
   `averageScore`, where that last call re-queries the database for an average over rows
   `listReviewThread` already returned.
6. **`listEpisodeScores` is unbounded** — aggregates every review for every episode, then the show
   page discards all but one show's worth.
7. **Images are unoptimised.** Four raw `<img>` tags to `i.ytimg.com`, no `next/image`, no
   dimensions, no lazy loading. Layout shift plus full-size JPEGs.

### What is structurally wrong with the current data layer

`ground-up-rebuild.md` §1–6 diagnoses this independently and in more depth; summarised here only so
Phase 1's scoping makes sense without cross-referencing constantly:

- SQLite for tests/local, Postgres for production, implemented twice — the direct cause of the
  duplicated ingest loop (`run.ts` vs `run-pg.ts`), duplicated review SQL, duplicated catalog
  assembly.
- **A live, confirmed bug in the current schema mechanism**, found empirically while building
  Phase 0 below, not just theorised: reads in `catalog.ts` / `reviews-pg.ts` are schema-qualified
  (`panel_club.shows`), but `catalog-ingest-pg.ts`'s writes are not (`FROM sources`, `INTO
  episodes`) — so the ingest job's correctness depends on a `search_path` set on the Neon role,
  entirely outside the repo and undocumented anywhere. This is exactly the "single wrong or missing
  env var silently points you at the wrong data" failure mode `ground-up-rebuild.md` §6 already
  calls out. Its fix (two Neon branches instead of schema-switching) resolves it structurally.

`ground-up-rebuild.md` is authoritative on how this gets fixed. Do not re-derive a different fix
here.

---

## Phase 0 — Local environment

**Done (2026-09-25).** No usable local `DATABASE_URL` existed, so nothing below could be verified —
not rendered, not screenshotted, not Lighthouse'd.

Stood up via **PGlite** (`@electric-sql/pglite` + `@electric-sql/pglite-socket`, embedded WASM
Postgres speaking the real wire protocol on `127.0.0.1:55432`) rather than Docker or a Homebrew
install — no daemon, nothing installed system-wide. `npm run dev:local` boots it, applies
`docs/sql/migrations/001_init.sql`, seeds from `content/catalog.json`, then runs `next dev` against
it. Verified: all seven routes render real seeded data (16 shows) end to end.

**This is local dev tooling only — not the integration-test strategy.** `ground-up-rebuild.md` §6
already specifies real Postgres (a Neon branch, or a CI service container) for integration tests,
explicitly rejecting a sqlite-mirrors-postgres approach for exactly the drift reasons above. PGlite
here plays a narrower role: giving `next dev` something to talk to on a laptop with no Postgres
installed. Two things worth knowing if this bridge is still in use when Phase 2 lands:

- `pglite-socket` defaults to 1 concurrent connection and resets extras under `Promise.all` load
  (`scripts/dev.ts` raises `maxConnections`); it's still occasionally flaky under concurrent
  requests to different routes — a retry succeeds. Fine for local iteration, not for CI.
- It doesn't honor the `options=-c search_path=...` connection-string parameter, which is how the
  search_path bug above was actually caught — `scripts/dev.ts` works around it by setting
  `search_path` per-session directly for DDL/seed, in-process, rather than relying on the
  connection string.

Superseded once `ground-up-rebuild.md`'s Neon `development` branch exists — at that point
`DATABASE_URL` can point there directly and `scripts/dev.ts` / `.claude/launch.json` can be
deleted.

---

## Phase 1 — Stop the bleeding

Small, self-contained, shippable in a day, independent of the data-layer rebuild. The full rewrite
(this plan plus `ground-up-rebuild.md`) will take a while and the live site is slow *now*.

1. Replace `force-dynamic` with `export const revalidate = 300` on catalog routes; add
   `generateStaticParams` for `/shows/[slug]`, `/shows/[slug]/episodes/[id]`, `/people/[slug]`.
2. Put the review thread behind `<Suspense>` so the shell paints immediately on a cold database.
   Largest perceived win available.
3. `next/image` with `remotePatterns` for `i.ytimg.com`, explicit dimensions, `priority` above the
   fold.
4. Delete the redundant `averageScore` query; derive it from the already-fetched threads.
5. Cross-instance catalog caching (`unstable_cache`, tag `catalog`), replacing the per-instance
   `catalogCache` variable that Phase 0 confirmed cannot work on Vercel.
6. Ingest-driven invalidation: a `POST /api/revalidate` route, bearer-secret guarded with
   **`crypto.timingSafeEqual`** (per `ground-up-rebuild.md`'s "defense in depth on secrets"
   principle — apply the same standard here even though that doc's own moot-endpoint comment was
   about the *ingest-trigger* route, not this *invalidation* one), calling `revalidateTag("catalog")`
   after a run with `inserted + updated > 0`.

Gate: `next build` shows those routes as static/ISR rather than `ƒ`; Lighthouse LCP and TTFB
measurably improve against the live origin.

**Do not touch** anything `ground-up-rebuild.md` §10 marks for deletion (the sqlite review/catalog
paths, `assertSafeSchemaName`, the in-memory rate limiter, the HTTP ingest route) — that's Phase 2's
job, done as *that* document's waves, not folded into this one.

---

## Phase 2 — Data layer

**= `docs/plans/ground-up-rebuild.md` §12, waves 1–5, executed as written.** Not repeated here to
avoid two copies drifting. Read that document before starting this phase. In one line: Postgres-only
(delete the sqlite production path, keep `node:sqlite :memory:` for pure-logic unit tests only),
two Neon branches instead of schema-switching, Upstash rate limiting with a trusted client-IP source
(deletes the in-memory limiter this plan's own Phase 1 audit flagged as spoofable), Dockerized
ingest on the existing Contabo VPS via GHCR, HTTP ingest route deleted.

Gate: that document's own "Done" section (§ "Done" — `CATALOG_SCHEMA`/search_path gone, two Neon
branch URLs, CI green on `tsc`+tests+`next build`, ingest published to GHCR, HTTP ingest route gone).

---

## Phase 3 — Design system

The wireframe lock is lifted. First deliverable is the replacement contract.

1. **`docs/design/platform/design.md`** — the new UI contract, superseding
   `docs/design/panel-platform/spec.md`. Mark the old spec superseded; do not silently orphan it.
   Needs approval before component work starts.
2. **Tailwind v4**, CSS-first config. Design tokens live in `@theme` — colour ramp, type scale,
   spacing, radii, elevation, easing curves, durations. No raw hex in components. The 743 lines of
   ad-hoc `globals.css` are replaced, not appended to.
3. **Rebuild the nine components**: header, show card, directory, schedule, people list, library
   list, player, cast button, review form.
4. **Fix the real UX defects**, not just the surface:
   - **Silent failures.** `submitReview` / `submitReply` return silently when rate-limited or when
     validation fails — the form appears to do nothing at all. Move to `useActionState` with inline
     error and success states. This is a genuine bug. Note: `ground-up-rebuild.md` §11 keeps
     over-limit as a silent no-op *by product decision* — that's about not exposing rate-limit
     state, and is compatible with also surfacing *validation* errors (empty body, bad star count)
     inline. Don't conflate the two.
   - No pending state on any submit.
   - No `:focus-visible` treatment; keyboard path unaudited.
   - `formatDuration` and the score formatters are duplicated across three page files.
5. **Empty states** for every screen, designed rather than bare text.
6. **`loading.tsx` per route** so navigation feels instant.

---

## Phase 4 — Motion

Library: **`motion`** (MIT, free, the maintained successor to framer-motion, `npm i motion`). It is
the right default for React and supports a hybrid approach — hardware-accelerated CSS under the
hood for simple transitions, JS springs only where needed.

If timeline-choreographed sequences turn out to matter more than React ergonomics, **GSAP** is the
alternative and is now fully free including all plugins. Pick one; do not ship both.

Planned motion:

- Shared-element transition: grid thumbnail morphs into the episode hero.
- Staggered card entrance on the directory grid.
- Crossfade and layout animation on category filter change.
- Star picker micro-interaction; spoiler reveal; skeleton shimmer on the streaming review list.
- Page transitions between routes.

**Non-negotiable:** everything respects `prefers-reduced-motion: reduce`, using the library's
reduced-motion support plus a CSS backstop. No exceptions.

Budget: motion must not undo Phase 1. Measure First Load JS before and after; if the animation
layer costs more than ~35 kB gz, cut scope rather than accept the regression.

---

## Phase 5 — Verification

Mechanical gates:

- `npx tsc --noEmit` clean.
- Full test suite green. Coverage must not end below where it started — 101 tests today, rewritten
  equivalents per Phase 2's own gates, not fewer.
- `npx next build` clean.

Not sufficient alone. Because this is a UI change it also needs:

- The app run in a browser, walking the golden path and edge cases on every screen: empty upcoming,
  empty library, Cast hidden on YouTube episodes, blocked embed, not-found, review submit success,
  review submit rate-limited, reply nesting refusal.
- Before/after Lighthouse on the live origin.
- Reduced-motion verified by actually toggling the OS setting.

Type checks and unit tests verify code correctness, not feature correctness. If the UI cannot be
exercised in a browser, that gets said plainly rather than reported as done.

Also run `ground-up-rebuild.md` §5's "hardening pass" (constant-time secret comparisons wherever one
remains, a short ingest-alert runbook) as part of this phase, not skipped because it's "someone
else's document."

---

## New dependencies

Surfaced per `AGENTS.md`. All free, all MIT or equivalent. Data-layer dependencies (if any) are
`ground-up-rebuild.md`'s to name, not duplicated here.

| Package | Phase | Why |
| --- | --- | --- |
| `@electric-sql/pglite`, `@electric-sql/pglite-socket` (dev, local-only) | 0 | Local Postgres for `next dev` with no Docker/Homebrew install; not part of CI |
| `tailwindcss` v4, `@tailwindcss/postcss` | 3 | Styling |
| `motion` | 4 | Animation |

Pre-existing, unrelated to this rewrite: `npm audit` currently flags a high-severity PostCSS
advisory via `next`'s own dependency tree (fix requires a Next 15→16 major bump). Not touched by
this plan; flagged here so it isn't mistaken for something Phase 3's Tailwind work introduced.

---

## Risks

- ~~Data loss.~~ Not a risk: `ground-up-rebuild.md` confirms production data is disposable — clean
  cutover, reseed from `content/catalog.json`, no Railway-sqlite-reviews migration.
- **Test coverage regression.** Rewriting the data layer means rewriting its tests. The suite must
  not shrink. Port tests *with* each module, not "at the end." (Phase 2's concern, per
  `ground-up-rebuild.md`'s own slice table.)
- **Long-lived branch.** The full rewrite will not land in one sitting. Phase 1 ships separately so
  the live site improves immediately; Phase 2 ships as `ground-up-rebuild.md`'s own waves; Phases
  3–4 land as reviewable PRs, not one mega-diff.
- **Docs drift.** `docs/design/platform/architecture.md` already describes an ingest endpoint and a
  `CATALOG_SCHEMA` variable that no longer exist, and `panel-platform.md` still locks
  "`node:sqlite`, not a hosted database" while production runs Postgres. `ground-up-rebuild.md`'s
  Phase 2 is the right place to correct both — don't let a third doc invent a third description of
  the same system.

## Resolved

- **Host: Vercel + Neon**, per `docs/ideas/free-host.md` and confirmed/extended by
  `ground-up-rebuild.md` (which adds the existing Contabo VPS for ingest). Railway artifacts
  (`railway.json`, `Dockerfile`, `.railwayignore`, `ops/panel-club-ingest.*` insofar as they're
  Railway-specific) retire per Phase 2.
- **Production data is disposable.** No backup gate, no schema-compatibility constraint.
- **Data layer plan: `ground-up-rebuild.md` governs**, not a Drizzle/fresh-schema rewrite. Superseded
  approach removed from this document entirely rather than left as a contradicting alternative.
- **Canonical repo: `laraib-labs/panel-club`.** Local `origin` repointed (was `laraib-sidd/panel-club`
  — same HEAD commit, just a stale URL, no divergence to reconcile).
