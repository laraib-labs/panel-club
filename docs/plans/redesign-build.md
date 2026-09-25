# Redesign build plan

Approved: marigold-on-ink theme, hero + upcoming-strip Discover, compact-list Show, two-column
Episode (see `docs/design/platform/redesign-2026.md` for rationale, `redesign-preview.html` for
the approved look). This plan is the execution order. No further check-ins until it's fully done,
verified, and running on local — per instruction.

## Order

1. **Theme tokens** — replace the palette in `globals.css` `@theme` directly (not layered as an
   alternate). Collapse `--color-rating` into `--color-accent` everywhere (one accent decision) —
   update `show-card.tsx` and `review-form.tsx` accordingly, remove the now-unused rating token.
2. **Nav** — `site-header.tsx` drops to 3 items (Discover, People, Library). Delete `/upcoming`
   route; add a `next.config.ts` redirect from `/upcoming` to `/` (courtesy, not load-bearing).
3. **Discover** (`directory.tsx` + `page.tsx`) — add a `Hero` (top-rated/most-recent show,
   full-bleed, watch CTA into its first episode) and an `UpcomingStrip` (reuses `splitSchedule()`,
   renders only when non-empty) above the existing search/filter/grid, which stay as-is.
4. **Show page** — hero cover gets the taller full-bleed treatment with title-over-image (scrim
   gradient), info row becomes stat chips, episode list switches from large cards to the numbered
   compact row list.
5. **Episode page** — two-column grid on desktop (player+description left, reviews right via the
   existing `Suspense`-wrapped `ReviewsSection`), one column on mobile. Player/review mechanics
   unchanged.
6. **People / Person / Library / not-found** — theme only, no structural change (already settled
   per the last pass).
7. **Full regression**: `tsc`, full test suite, `next build`, then a real browser walk of every
   page at both desktop and mobile widths — the hero and two-column episode layout specifically
   need a mobile check since they're new.

Report back only at the end, with evidence (test/build output, screenshots), not at each step.
