# Ingest operator runbook

Use this when **healthchecks.io** alerts on the Panel Club catalog ingest check (missed ping or a **Down** from `/fail`).

## What the alert means

| Signal | Likely cause |
|--------|----------------|
| **Missed ping** (late / never arrived) | Timer did not run, `docker pull`/`docker run` failed before the job started, container crashed before `/start`, or success ping never reached healthchecks.io |
| **Down via `/fail`** | The ingest container ran, hit an error, and the CLI POSTed to `HEALTHCHECKS_URL/fail` with a stack snippet |

The job pings **GET** `…/start` at boot, **GET** the base URL on success, and **POST** `…/fail` on failure. Timer schedule: every 30 minutes (`panel-club-ingest.timer`).

## First response (on the VPS)

1. **Last systemd timer run**

   ```bash
   systemctl status panel-club-ingest.timer --no-pager
   journalctl -u panel-club-ingest.service -n 200 --no-pager
   ```

   Confirm whether the unit ran, exited non-zero, or failed during `docker pull`.

2. **Container output from the last run**

   Logs go to journald via the service (not a long-lived container). If you need a one-off repro:

   ```bash
   docker pull ghcr.io/laraib-labs/panel-club-ingest:latest
   docker run --rm --env-file /etc/panel-club.env ghcr.io/laraib-labs/panel-club-ingest:latest
   ```

   Do not paste env values into tickets or chat.

3. **Healthchecks.io UI**

   Open the check’s log: **/fail** entries include the error body (up to 8k). **Missed** with no `/fail` often means infra/timer/pull, not application logic.

## Environment file (names only)

On the VPS: `/etc/panel-club.env` (mode `600`, root). Ingest reads:

| Variable | Role |
|----------|------|
| `DATABASE_URL` | Neon **direct** host (non-pooler). Pooler URLs can stall long ingest transactions. |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key for catalog fetch |
| `HEALTHCHECKS_URL` | Base ping URL (optional; no pings if unset) |

See `ops/panel-club.env.example`. Fix missing/wrong names there; never commit or copy secret values into git.

## Image tag (GHCR)

CI pushes on `main` (paths under platform/Dockerfile/content/ops):

- `ghcr.io/laraib-labs/panel-club-ingest:latest`
- `ghcr.io/laraib-labs/panel-club-ingest:<git-sha>`

The timer unit pulls **`:latest`** before each run. To see what shipped recently, use the GitHub Actions **Ingest image** workflow commit SHA for that push.

## Rollback to a known good image

If a bad **`latest`** deploy is suspected, pin the previous commit SHA instead of `:latest`:

1. Pick `<sha>` from the last green **Ingest image** run before the incident.
2. Run once manually:

   ```bash
   docker pull ghcr.io/laraib-labs/panel-club-ingest:<sha>
   docker run --rm --env-file /etc/panel-club.env ghcr.io/laraib-labs/panel-club-ingest:<sha>
   ```

3. To keep the timer on that build until `main` is fixed, edit `/etc/systemd/system/panel-club-ingest.service` `ExecStart` to use `:<sha>` instead of `:latest`, then:

   ```bash
   systemctl daemon-reload
   ```

   Revert to `:latest` after a verified fix is on `main`.

Ensure GHCR read auth on the host is still valid (`docker login ghcr.io`) if pulls fail.

## YouTube errors: quota vs transient 5xx

The YouTube client **retries** HTTP **429** and **5xx** (backoff, up to 5 attempts). It does **not** treat generic **403** (typical **quota exceeded**) as retryable.

| Symptom in logs | Interpretation | Action |
|-----------------|----------------|--------|
| `429`, repeated then failure | Rate limit | Usually clears with backoff; if persistent, reduce frequency or review API usage |
| `5xx` from `googleapis.com` | Google-side / transient | Retry next timer tick; escalate if multi-hour |
| `403` / quota / `quotaExceeded` in response body | Daily quota exhausted | Wait for quota reset (Pacific midnight) or raise quota in Google Cloud; **do not** spam manual reruns |
| DB / Neon errors | `DATABASE_URL`, network, or schema | Verify direct URL, Neon status, migrations |

After fixing config or quota, trigger one manual `docker run` (above) and confirm a success ping in healthchecks.io before closing the incident.

## Out of scope for this runbook

- Vercel app errors and Sentry (separate checks).
- Review rate-limit UI (not ingest).
