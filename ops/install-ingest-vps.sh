#!/usr/bin/env bash
# Install Panel Club ingest timer on the Contabo VPS (run as root).
# Copies systemd units from this repo's ops/ directory; does not store secrets in git.
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "install-ingest-vps.sh: run as root on the VPS." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE=/etc/panel-club.env
ENV_EXAMPLE="${SCRIPT_DIR}/panel-club.env.example"
IMAGE=ghcr.io/laraib-labs/panel-club-ingest:latest

if ! command -v docker >/dev/null 2>&1; then
  echo "install-ingest-vps.sh: docker not found. Install Docker before enabling the timer." >&2
  exit 1
fi

# One-time GHCR read auth on the VPS (not committed to git):
#   Create a fine-grained or classic GitHub PAT with read:packages, scoped to laraib-labs/panel-club.
#   echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
# Re-login after token rotation. GITHUB_TOKEN from Actions is push-only and not for the VPS.

install -m 644 "${SCRIPT_DIR}/panel-club-ingest.service" /etc/systemd/system/panel-club-ingest.service
install -m 644 "${SCRIPT_DIR}/panel-club-ingest.timer" /etc/systemd/system/panel-club-ingest.timer

if [[ -f "${ENV_FILE}" ]]; then
  echo "Leaving existing ${ENV_FILE} unchanged."
else
  if [[ ! -f "${ENV_EXAMPLE}" ]]; then
    echo "install-ingest-vps.sh: missing ${ENV_EXAMPLE}" >&2
    exit 1
  fi
  install -m 600 "${ENV_EXAMPLE}" "${ENV_FILE}"
  echo "Created ${ENV_FILE} from example — set DATABASE_URL (Neon direct) and YOUTUBE_API_KEY."
fi

systemctl daemon-reload
systemctl enable --now panel-club-ingest.timer
systemctl status panel-club-ingest.timer --no-pager || true

echo "Ingest image: ${IMAGE} (timer pulls :latest before each run)."
