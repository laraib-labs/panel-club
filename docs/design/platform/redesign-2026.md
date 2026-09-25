# Panel Club — from-scratch redesign

Supersedes `docs/design/panel-platform/spec.md` as the UI contract (wireframe lock lifted per
`docs/plans/ui-rebuild.md`). This is a committed proposal, not a menu — built on the working data
layer and local infra already in place. "From scratch" here means the visual design and page
composition are rethought; it does not mean re-doing Postgres/Redis/the component token system,
which are infrastructure, not design.

## Why these choices

Panel Club catalogs Indian comedy panel/game shows — a small, curated catalog (16 shows, ~300
episodes), not a mass-catalog streaming service. The design should read as **curated and
opinionated**, not as a generic Netflix clone. Two decisions follow from that:

1. **Don't invent pages the catalog doesn't support.** Netflix-style category rows need enough
   items per row to feel intentional rather than sparse — with 16 shows across 4 categories, some
   rows would have 3 items. The page *count* stays close to what exists; the redesign value is in
   composition and theme, not proliferation.
2. **One theme, fully committed**, not a copy of a streaming app's palette. Detailed below.

## Sitemap — 7 pages (was 8; Upcoming folds into Discover)

| # | Route | Purpose |
|---|---|---|
| 1 | `/` — Discover | Browse, search, filter. Entry point. |
| 2 | `/shows/[slug]` | One show: hero, info, full episode list. |
| 3 | `/shows/[slug]/episodes/[id]` | Watch + rate + review one episode. |
| 4 | `/people` | Browse hosts and guests. |
| 5 | `/people/[slug]` | One person's hosted/guest appearances. |
| 6 | `/library` | Device-local continue/history/watchlist. |
| — | `/not-found` | Unknown show or episode. |

**Change: Upcoming is no longer a nav-level page.** Today it's a top-level tab that, per the seed
data, is usually just an empty state ("Nothing announced") followed by the same aired-show list
Discover already shows — a whole page devoted to a list that duplicates Discover, gated behind
its own nav slot, mostly empty. It becomes a **strip at the top of Discover**, shown only when a
dated episode actually exists. Nav goes from 4 items to 3: **Discover, People, Library.** One
less thing competing for attention in the header, and the schedule shows up where someone's
already looking instead of requiring a dedicated trip.

## Page compositions

### Discover (`/`)
- **Hero** — the single highest-rated or most-recent show, full-bleed cover, title, host, one-line
  hook, a direct "Watch" CTA into its top episode. Replaces the current flat "here are 16 cards"
  opener with one confident opinion up front — curation, not a catalog dump.
- **Upcoming strip** — only rendered when `splitSchedule().upcoming` is non-empty. A single
  horizontal row of dated episodes above the grid.
- **Search + category filter** — kept as-is; it already works well.
- **Grid** — kept, but the score badge and hover treatment carry the new theme (below).

### Show (`/shows/[slug]`)
- **Cover** — larger, full-width hero treatment (taller aspect, gradient scrim for title
  legibility over the image) instead of a boxed 16:9 card.
- **Info row** — host, category, score as small stat chips, not a comma-joined sentence — easier
  to scan.
- **Episode list** — switches from repeated large thumbnail cards to a **numbered compact row
  list** (thumbnail shrinks, title/score/status stay). Shows with 20–30+ episodes (Andha Pyaar has
  31) currently produce a long scroll of identical large cards; a denser list scans faster and
  reads more like a real episode guide.

### Episode (`/shows/[slug]/episodes/[id]`)
- **Two-column on desktop**: player + description in a wider left column, reviews in a narrower
  right column — reviews are currently forced below a full-width player, wasting the sides of the
  screen on any display wider than the video itself. Stacks to one column on mobile.
- Player, rating, and review mechanics are unchanged — this is a layout change, not a feature
  change.

### People (`/people`) / Person (`/people/[slug]`)
- Kept structurally; carries the new theme. No functional change — the grid-of-monograms pattern
  already works and 150+ people don't need a redesigned browsing model.

### Library (`/library`)
- Kept structurally; carries the new theme.

## Theme: "Marigold on ink"

Dark canvas — video thumbnails are the most colorful thing on every screen, and a dark surface
makes them the focus instead of competing with a busy background. One accent, used for everything
that means "this is an action or a rating" — not two colors doing similar jobs. Marigold/amber is
deliberate: it's a warm, high-energy color with real cultural resonance for the content (marigold
is a color of celebration in Indian visual culture) and it isn't the generic red/green/blue trio
every streaming and film app already uses.

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg-deep` | `#0a0908` | Page background — warmer, darker ink than today's purple-black |
| `--color-bg` | `#100e0b` | One step up |
| `--color-surface` | `#1a1611` | Cards, rows |
| `--color-surface-raised` | `#251f17` | Modals, hover |
| `--color-border-subtle` | `#221c15` | Hairlines |
| `--color-border` | `#332b1f` | Emphasized dividers |
| `--color-text` | `#f5efe1` | Primary — warm off-white |
| `--color-text-muted` | `#a89a83` | Meta |
| `--color-text-subtle` | `#6e6453` | Tertiary |
| `--color-accent` | `#f0a020` | The one accent — actions, active nav, ratings, links |
| `--color-accent-hover` | `#ffb84d` | Hover/lighter step |
| `--color-accent-muted` | `#3a2a10` | Low-key accent backgrounds (badges) |
| `--color-ink` | `#1a0f00` | Text on accent-filled surfaces |
| `--color-danger` | `#e0644a` | Errors only |

**One accent, not two.** Today's build deliberately split brand pink from a separate rating gold.
Collapsing that: one warm marigold does both jobs, same as Letterboxd uses one green for both. The
site becomes more visually coherent, not less — every warm-colored element on the page now means
the same thing ("this matters"), instead of asking the viewer to distinguish two similarly-warm
hues by role.

Typography stays Geist (already fast, self-hosted, zero layout shift) — the theme change is color
and layout, not typeface. Hero moments (Discover's hero title, show titles) get a larger, heavier
weight than the rest of the type scale to signal "important" the way the old design didn't.

## What does not change

- Data layer, local infra (Postgres/Redis/Docker), rate limiting, ingest — none of this is a
  design concern and none of it is being redone.
- Review/rating mechanics, library tracking, Cast — same features, new visual home.
- The token-system approach (Tailwind `@theme`, one `chip-styles.ts`/`search-field.tsx` reused
  everywhere) — that infrastructure is what makes a *second* real theme change cheap; it stays.

## Build order

1. Theme tokens (new palette, replacing the current one directly — not layered as an alternate).
2. Discover: hero + upcoming strip + existing grid.
3. Show: hero treatment + compact episode list.
4. Episode: two-column layout.
5. People/Person/Library: reskin only, already structurally settled.
6. Full regression: `tsc`, tests, `next build`, browser walk of every screen at both desktop and
   mobile widths (the two-column episode layout and hero specifically need a mobile check).
