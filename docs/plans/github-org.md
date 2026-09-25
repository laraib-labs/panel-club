# Configure GitHub organization (`laraib-labs`)

Harden and wire the **laraib-labs** org so both Laraib accounts are equal owners, pers repos live there, and deploy apps (Railway, later Vercel) can reach private repos. No product code changes.

Citations: [org PATCH](https://docs.github.com/en/rest/orgs/orgs#update-an-organization), [base permissions](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/setting-base-permissions-for-an-organization), [transfer repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository), [org teams](https://docs.github.com/en/rest/teams/teams).

## What / why

`panel-club` already transferred to `laraib-labs/panel-club`, but org defaults are still wide open (`default_repository_permission: read`, any member can create/delete repos, no 2FA requirement). Local `origin` still points at `laraib-sidd/panel-club`. Railway GitHub connect failed earlier because the app identity did not match the repo owner — org-level app install fixes that for all pers repos.

This plan is **org + deploy wiring only**. It does not move reviews to Neon or deploy to Vercel (`docs/ideas/free-host.md` is a separate track).

## Current state (2026-09-24)

| Item | Status |
| --- | --- |
| Org `laraib-labs` | Exists, Free plan |
| Owners | `laraib-sidd`, `laraibsidd-dev` (membership role `admin`) |
| `panel-club` | `laraib-labs/panel-club` on GitHub |
| Local `origin` | Still `git@github.com:laraib-sidd/panel-club.git` |
| Teams | None |
| `gh` token scopes | `read:org`, `repo` — **missing `admin:org`** for policy PATCH |
| Railway | Live via CLI; GitHub auto-deploy blocked on old personal repo |

## Architecture

```text
laraib-labs (org, Free)
├── owners: laraib-sidd, laraibsidd-dev
├── team: pers (Admin on repos)
├── repo: panel-club (private)
└── GitHub Apps: Railway, Vercel (org install, repo-scoped)
```

- **Pers boundary:** only `~/pers` repos in this org. Never `~/work`.
- **Access model:** org owners for billing/apps/settings; `pers` team gets Admin on each pers repo so day-to-day work does not need per-repo invites.
- **Automation:** `gh api` for policies and teams. GitHub App install stays in the browser (no API for “install Vercel on org”).

## Prerequisite (before any slice)

```bash
gh auth refresh -h github.com -s admin:org
gh auth status   # confirm admin:org present
```

## Files / symbols

| Slice | Owns | Blocked by | Verify |
| --- | --- | --- | --- |
| Org policies | (no repo files — `gh api` only) | Prerequisite | `gh api /orgs/laraib-labs --jq '{default_repository_permission,two_factor_requirement_enabled,members_can_create_repositories,members_can_delete_repositories}'` |
| Team `pers` | (no repo files — `gh api` only) | — | `gh api /orgs/laraib-labs/teams/pers/repos --jq '.[].full_name'` |
| Repo remote + deploy | `docs/knowledge/pers-knowledge.md` (Panel Club + org section) | Org policies | `git -C ~/pers/panel-club remote get-url origin` shows `laraib-labs/panel-club`; Railway service linked to org repo |

No `src/` changes. No design bead.

### Slice 1 — Harden org policies

`PATCH /orgs/laraib-labs`:

```json
{
  "default_repository_permission": "none",
  "members_can_create_repositories": false,
  "members_can_delete_repositories": false,
  "members_can_change_repo_visibility": false,
  "members_can_fork_private_repositories": false,
  "members_can_invite_outside_collaborators": true,
  "two_factor_requirement_enabled": true,
  "web_commit_signoff_required": false,
  "default_repository_branch": "main"
}
```

Read back and confirm. If 2FA PATCH fails because a member lacks 2FA, enable 2FA on both accounts first, then retry.

### Slice 2 — Team `pers`

```bash
gh api -X POST /orgs/laraib-labs/teams \
  -f name='pers' -f description='Pers projects' -f privacy='closed'

gh api -X PUT /orgs/laraib-labs/teams/pers/repos/laraib-labs/panel-club \
  -f permission='admin'
```

Add both owners to the team if they are not auto-included (owners have implicit access; team is for future members).

### Slice 3 — Local remote + deploy apps

**Git remote** (on any machine that clones panel-club):

```bash
cd ~/pers/panel-club
git remote set-url origin git@github.com:laraib-labs/panel-club.git
git fetch origin
```

**Railway** (browser, as org owner):

1. Railway → Project **panel-club** → Service **web** → Settings → Connect repo.
2. Select **laraib-labs/panel-club**, branch `main`.
3. Confirm deploy triggers on push.

**Vercel** (browser, when hosting plan locks):

1. Vercel → Add project → Import `laraib-labs/panel-club`.
2. Install GitHub App on org if prompted; grant `panel-club` only.

**Durable note** in `~/pers/docs/knowledge/pers-knowledge.md`: org name, both owners, team name, repo path, that Railway should use org repo not personal fork.

## Locked decisions

- Org name: **laraib-labs** (already created).
- Both `laraib-sidd` and `laraibsidd-dev` are **org owners** (already true).
- **GitHub Free** org — no Team plan upgrade for this.
- Base permission **None**; only owners create repos (transfer in, not sprawl).
- **Require 2FA** for all org members.
- **pers** team with Admin on each pers repo as they land.
- **No** `~/work` repos in this org.
- **No** Neon/Vercel/sqlite migration in this plan.
- Git writes only inside `panel-club` / pers repos — never at `~/pers` root.

## Gotchas

- `gh org` only has `list` — all org admin is `gh api` or the web UI.
- GitHub MCP has **no** org-settings tools (repos/PRs/issues only). Use `gh`, not MCP, for this plan.
- Membership role `admin` in the API means **org owner**, not “repo admin”.
- Transferring a repo does **not** update local remotes or Railway service source — both must be repointed manually.
- `admin:org` scope is required for PATCH and team create; `read:org` is not enough.
- Org secrets (`gh secret set --org`) are optional here; Panel Club env vars stay on Railway/Vercel until the host plan changes.

## Done

- `gh api /orgs/laraib-labs` shows `default_repository_permission: none`, `members_can_create_repositories: false`, `two_factor_requirement_enabled: true`.
- Team `pers` exists and lists `laraib-labs/panel-club`.
- `git remote get-url origin` in `~/pers/panel-club` is `laraib-labs/panel-club`.
- Railway service source is `laraib-labs/panel-club` (or documented as blocked with reason).
- `pers-knowledge.md` has a short **laraib-labs** subsection under Panel Club or a new **GitHub org** heading.
- No open beads for this epic.
