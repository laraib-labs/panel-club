# Comedy UX

Make Panel Club look and play like a comedy streamer before any host move. Same product as `docs/plans/panel-platform.md`: catalog JSON, cookie reviews, `localStorage` library. New skin, posters, player, people search, one-level replies.

Locked from `docs/ideas/comedy-ux.md` (Decision filled). Do not reopen.

Citations: YouTube embed + privacy-enhanced player ([Help](https://support.google.com/youtube/answer/171780)); thumbs `i.ytimg.com` (same as the old directory). Comedy-stream palette structure from Dropout lean-back + one loud accent ([brand writeup](https://www.brilliantvisions.com/dropout-overview/dropout-brand/)) — copy structure, not logo. Rate-limit IP via `await headers()` in the server action ([Next.js headers](https://nextjs.org/docs/app/api-reference/file-conventions/route)). Iframe `allow` must include `fullscreen` for Chrome.

## What / why

The site is usable and still looks like a wireframe: lime tiles, no posters, People is a `<ul>`, reviews are numbered radios, the YouTube iframe is a 640px padded box without `allow="…; fullscreen"`. Replies need a new row identity because the current PK is `(episode_id, viewer_id)`.

## Architecture

```text
YouTube iframe  →  player.tsx (fullscreen + Open on YouTube)
i.ytimg.com     →  youtubeThumbUrl(videoId)  →  cards / rows
pc_viewer cookie →  root review upsert + replies (parent_id)
headers() IP     →  takeReviewSlot(ip) in-memory
localStorage     →  library (unchanged model)
```

**Reviews schema.** Today `PRIMARY KEY (episode_id, viewer_id)` cannot hold replies from the same viewer. Replace with:

```sql
id TEXT PRIMARY KEY
episode_id, viewer_id, parent_id (NULL = root)
display_name, stars (NULL on replies), body, spoiler, created_at
UNIQUE (episode_id, viewer_id) WHERE parent_id IS NULL
```

`initReviewsSchema` may `DROP TABLE IF EXISTS reviews` then create (personal sqlite; no migration tool). `averageScore` / show averages count **root** rows only. `saveReview` upserts the root. `saveReply({ parentId, … })` inserts; rejects if parent missing, parent is itself a reply, or that viewer already has 3 replies on that episode. Display name and body: trim, max 40 / 500, strip tags. Display name **may change** on the cookie; `viewer_id` stays.

**Rate limit.** Process-local map, 5 review-or-reply POSTs per IP per minute. `x-forwarded-for` first hop, else `x-real-ip`, else `"local"`. Fine for one replica.

**Player.** `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"` plus `allowFullScreen`. Wrapper is full column width, 16:9, no decorative min-height padding. Under the iframe: `Open on YouTube` → `https://www.youtube.com/watch?v={videoId}`. File episodes stay `<video>` + Cast.

**Thumbs.** `https://i.ytimg.com/vi/{id}/hqdefault.jpg` via `<img>` (not `next/image` — no remotePatterns). Alt from title. No Wikipedia faces.

**People.** Client search over `listPeople`, same empty+Clear pattern as Discover. Monogram: two letters from the name.

## Files / symbols

| Slice | Owns | Blocked by | Test |
| --- | --- | --- | --- |
| Design | `docs/design/comedy-ux/wireframe.html`, `notes.md`, `spec.md` | — | (screens: `/design`) |
| Reviews engine | `src/lib/reviews.ts`, `src/lib/reviews.test.ts` | — | `node --experimental-strip-types --test src/lib/reviews.test.ts` |
| Rate limit | `src/lib/review-rate-limit.ts`, `src/lib/review-rate-limit.test.ts` | — | `node --experimental-strip-types --test src/lib/review-rate-limit.test.ts` |
| Skin | `src/app/globals.css`, `src/lib/thumbs.ts`, `src/lib/thumbs.test.ts`, `src/components/show-card.tsx`, `src/components/directory.tsx`, `src/components/library-list.tsx`, `src/app/shows/[slug]/page.tsx`, `docs/design/comedy-ux/spec.md` | Design | `node --experimental-strip-types --test src/lib/thumbs.test.ts` |
| People | `src/lib/people.ts`, `src/lib/people.test.ts`, `src/components/people-list.tsx`, `src/app/people/page.tsx`, `src/app/people/[slug]/page.tsx`, `docs/design/comedy-ux/spec.md` | Design, Skin | `node --experimental-strip-types --test src/lib/people.test.ts` |
| Episode | `src/components/player.tsx`, `src/components/review-form.tsx`, `src/app/shows/[slug]/episodes/[id]/page.tsx`, `docs/design/comedy-ux/spec.md` | Design, Reviews engine, Rate limit, Skin | `node --experimental-strip-types --test src/lib/reviews.test.ts src/lib/review-rate-limit.test.ts` |

Skin owns **all new CSS class names** (player, cards, people, review, reply) so People and Episode do not edit `globals.css`. People is blocked by Skin so those classes exist. UI slices share `spec.md` — `/go` runs **one UI child per wave**.

Symbols: `youtubeThumbUrl()`, `personMonogram()`, `saveReply()`, `listReviewThread()`, `averageScore` roots-only, `takeReviewSlot(ip)`, `REVIEWS_PER_IP_PER_MINUTE = 5`, `MAX_REPLIES_PER_EPISODE_PER_VIEWER = 3`.

## Locked decisions

Copied from the idea file; do not reopen.

- **Product:** Comedy-streaming site: dark stage, hot-pink accent, YouTube posters, working player, searchable people as letter monograms, browser library, episode reviews with one-level replies — no accounts.
- **Success:** Poster grid; full-bleed 16:9 + fullscreen or Open on YouTube; starred review; one-level replies; same browser may rename; one root review per episode per cookie (replace); IP burst rejected; People search + monograms; library without an account.
- **Constraints:** No accounts. Library in `localStorage`. Letter monograms only. Dead embed → Open on YouTube, do not hide, do not restream. Official iframe only. Four header destinations. No Vercel/Neon/org in this work. Catalog JSON stays. Replies one level; stars on roots only.
- **Smallest version:** Ink + hot rose tokens. Posters. Player full-bleed + fullscreen + Open on YouTube. People search + monogram. Review UI + editable display name + one-level reply + length + IP rate limit. Library thumbs. Header unchanged.
- **Not in this version:** Sign-in, reply-to-reply, moderation dashboard, CAPTCHA, email reports, comic photos, Dropout logo/carousel clone, YouTube Data API, restreaming, Vercel/Neon/hosting, GitHub org.

Also: `pc_viewer` keeps `max-age` (persist the cookie). Display name field stays visible so they can rename.

## Gotchas

- Partial unique index on sqlite: `CREATE UNIQUE INDEX … WHERE parent_id IS NULL`.
- Client components must not import `reviews.ts` (`node:sqlite`).
- `allowFullScreen` without `fullscreen` in `allow` is why Chrome blocks fullscreen today.
- In-memory rate limit resets on process restart; that is acceptable.
- Existing review rows vanish on `DROP TABLE` — expected for this sqlite.
- UI children all list `spec.md`; do not parallel them.

## Done

- Wireframe + `spec.md` approved (`/design`).
- Tests above pass.
- Player fullscreen works in a real browser; Open on YouTube is on the episode page.
- Discover/show/library rows show YouTube thumbs.
- People has search + monograms.
- Root upsert + one-level replies + length + IP limit behave as tests say.
- No accounts, no hosting work in the diff.
