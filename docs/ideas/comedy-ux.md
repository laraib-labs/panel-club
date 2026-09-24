# Comedy UX for Panel Club

## Product
A comedy-streaming site (dark stage, hot-pink accent, YouTube posters) with a working player, searchable people as letter monograms, a browser library, and episode reviews with one-level replies — still no accounts.

## User and moment
Laraib has a working catalog, player, reviews, people list, and library. It looks like a styled wireframe: lime-on-near-black, no images, People is a bullet list, reviews are a numbered radio form. He will not add login. He wants a **new** palette (not lime, not the amber we first guessed), letter monograms, Open on YouTube when the embed dies, and replies if we can stop display-name hopping and spam.

## What they do today
- **Discover / show / episode:** text cards. Catalog already has `coverVideoId` and episode `videoId`. The UI never renders `img`. YouTube thumbs exist (`i.ytimg.com/vi/{id}/hqdefault.jpg`) and are unused.
- **Reviews:** cookie `pc_viewer` (UUID + display name). One row per `(episode_id, viewer_id)`. Stars are radios labelled 1–5. Display name **can be rewritten** on every submit. No max body length, no rate limit. Clearing cookies = a new identity = another review.
- **People:** every host/guest as `<li><a>`. No search. Person page is two text lists.
- **Library:** `localStorage` key `panel-club-library`. Continue / History / Watchlist. Device-local.
- **Header:** Discover, Upcoming, People, Library.
- **Player:** iframe `youtube-nocookie.com/embed/{videoId}`. `allow` is missing `fullscreen`. Tile is padded, max-width 640px.

## Job to be done
Make every screen scannable (thumb + title + meta), play full-bleed with working fullscreen, find a comic by search, leave a review and a reply without signing in, and make casual spam (name-hopping, flood POSTs) fail.

## Success
A visitor finds a show from a poster grid, plays an episode full-bleed 16:9 with fullscreen, or gets **Open on YouTube** if the iframe is blocked. They leave a starred review, someone else can reply once under it. Same browser may change its display name. Same browser cannot leave a second root review on that episode (replace only). A burst of POSTs from one IP is rejected. People search + letter monograms. Library still works with no account.

## Constraints
- **No accounts.** Library, continue, watchlist, history stay in `localStorage`.
- People: **letter monogram only.** No scraped faces.
- Dead embed → **Open on YouTube**. Do not hide the episode. Do not download/restream.
- Play YouTube **only** via their embed iframe.
- Same four header destinations.
- Do not productionize (Vercel, Neon, org) in this idea.
- Catalog JSON stays the source of show/people data.
- Replies: **one level** (reply to a review, not to a reply). Stars only on the root review.

## Recommendation
**Restyle like a comedy streamer, not a login wall.**

**Palette:** drop lime **and** drop amber. Current comedy streaming (Dropout.tv: dark lean-back UI + one loud accent, [brand writeup](https://www.brilliantvisions.com/dropout-overview/dropout-brand/)) is ink black + a hot pink/magenta hit, off-white type. We copy **that structure**, not their logo or wordmark: `--bg` near-black, `--accent` hot rose (`#ff2d7b` class), cream text. `/design` paints the exact tokens on the wireframe.

Cards: 16:9 YouTube thumb, title, host, score. People: search at top + two-letter monogram. Player: full-bleed 16:9, `allow` includes `fullscreen`; black box → Open on YouTube.

**Library, no login.** Other phone = empty library. That is the product.

**Reviews + one-level replies, with a frozen name.**
- Root: one starred review per episode per cookie (upsert). Body length capped. No HTML.
- Reply: optional, nested under a root review, no stars, same length cap. Cap **replies per episode per cookie** (small, e.g. 3) plus IP rate limit.
- **Display name may change on the same browser.** The cookie keeps the viewer id; the name on new posts/replies is whatever they typed last. Impersonation of *other* people is still possible without accounts; rate limit + upsert + reply cap are the brakes, not a frozen handle.
- New cookie (cleared storage / another browser) = new identity. Cannot stop that without accounts.

## Alternative that loses and why
**Accounts to freeze identity.** User said no hurdle. Cookie upsert + reply cap + rate limit is the version that matches that. Same-browser rename stays allowed.

**No replies.** He wants them if spam is handled. Shallow replies + frozen name is enough; a full forum is not.

## Smallest version
New tokens (ink + hot rose). YouTube posters. Player full-bleed + fullscreen + Open on YouTube. People search + monogram. Review cards + star control + **editable display name** + one-level reply + length + IP rate limit. Library thumbs. Header unchanged.

## Not in this version
Sign-in, reply-to-reply, moderation dashboard, CAPTCHA, email reports, comic photos, Dropout clone of logo/carousel, YouTube Data API, restreaming, Vercel/Neon/hosting, GitHub org.

## Needs screens
yes

## Decision
Lock. No login. Library stays in this browser. Palette is a new comedy-stream look (ink + hot rose, not lime). People are letter monograms plus search. Dead player → Open on YouTube. Reviews keep stars; add one-level replies. Same browser may keep changing its display name. One root review per episode per cookie (replace). Cap replies, length, and IP rate. Embed iframe only — no restream. Hosting and GitHub org are not this work. Needs screens: yes. `/design` after `/plan`.