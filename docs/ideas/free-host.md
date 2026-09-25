# Free host for Panel Club

## Product
A public Next.js Panel Club on **Vercel Hobby**, with reviews in a separate free database (Neon), not on a Railway volume.

## User and moment
Laraib already has the site on Railway (trial, one month). Reviews are `node:sqlite` on `/data`. Storage can move to Neon or similar. The remaining question is which **app compute** is $0 after the trial.

## What they do today
`next start` on Railway `web`. GitHub `laraib-sidd/panel-club` (private). Discover, play, and reviews work on `https://web-production-30e926.up.railway.app/`. Library is `localStorage`.

## Job to be done
Run the Next.js app on a host that does not charge after Railway’s trial, given the database is someone else’s problem.

## Success
One month after the Railway trial ends, the public origin still 200s on Hobby quotas, with no card charged for the app runtime.

## Constraints
- Database is not on the app filesystem. No sqlite volume.
- One Next.js app, Node 22 enough for Vercel’s Next runtime.
- No accounts product. Catalog stays in git. Library stays in the browser.
- Private GitHub is allowed.

## Recommendation
**Vercel Hobby + Neon Free.** That is the combination.

Vercel is the app (Next.js, GitHub, `$0` Hobby). Neon is the reviews table (`DATABASE_URL`, `$0` Free, scale-to-zero after 5 minutes idle). Nothing else in the stack: no Supabase, no volume, no VM.

You rewrite `reviews.ts` / `reviews-db.ts` off `node:sqlite`. First visitor after idle waits on Neon, not on Vercel.

## Alternative that loses and why
**Render free web.** Once there is no disk requirement it looks eligible (Git deploy, Next). Free instances **sleep after 15 minutes idle**. Every quiet visit pays a spin-up, stacked on Neon’s own wake. You also get 750 instance-hours, not “always on.” Worse UX than Vercel for a site that sits idle.

Oracle Always Free is still free compute, but it is a VM you patch. Pointless if Neon already holds the data.

## Smallest version
Connect the GitHub repo to Vercel, Hobby project, `DATABASE_URL` (Neon pooled). No custom domain. No Railway volume.

## Not in this version
Custom domain, staying on Railway Hobby paid, Fly (no standing free compute), Netlify (same serverless class, worse Next.js fit), sqlite on the app host.

## Needs screens
no

## Decision
