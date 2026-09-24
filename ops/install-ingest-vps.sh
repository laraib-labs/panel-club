#!/usr/bin/env bash
# Run on the Contabo VPS as root after cloning panel-club to /opt/panel-club.
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "install-ingest-vps.sh: run as root on the VPS." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE=/etc/panel-club.env
ENV_EXAMPLE="${SCRIPT_DIR}/panel-club.env.example"

if [[ ! -x /usr/bin/node ]]; then
  echo "install-ingest-vps.sh: /usr/bin/node not found. Install Node 22+ before enabling the timer." >&2
  exit 1
fi

if ! /usr/bin/node --version 2>/dev/null | grep -qE '^v22\.'; then
  echo "install-ingest-vps.sh: warning — /usr/bin/node is not v22.x (got $(/usr/bin/node --version 2>/dev/null || echo unknown))." >&2
fi

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
  echo "Created ${ENV_FILE} from example — set DATABASE_URL (Neon direct), CATALOG_SCHEMA, and YOUTUBE_API_KEY."
fi

systemctl daemon-reload
systemctl enable --now panel-club-ingest.timer
systemctl status panel-club-ingest.timer --no-pager || true
