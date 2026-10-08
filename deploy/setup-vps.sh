#!/usr/bin/env bash
# Step 1 of 2 — prepares a fresh Ubuntu/Debian VPS for the Tashwin API and clones the repository.
#   curl -fsSL https://raw.githubusercontent.com/adbhargav/tashwin/main/deploy/setup-vps.sh | bash
# Afterwards copy server/.env to the server and run deploy/start.sh (see README in this folder).
set -euo pipefail

APP_DIR=/var/www/tashwin
REPO=https://github.com/adbhargav/tashwin.git

echo "==> Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx ufw ca-certificates

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo "==> Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2

echo "==> Firewall: allow SSH, HTTP, HTTPS"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

echo "==> Code"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR/server"
npm ci --omit=dev
mkdir -p uploads

if [ ! -f .env ]; then
  cp .env.example .env
  echo
  echo "!! server/.env was created from the example and still needs your real values."
fi

cat <<MSG

Setup complete. Next:
  1. Put the real settings in $APP_DIR/server/.env
     (easiest: from your Mac run   scp server/.env root@<server-ip>:$APP_DIR/server/.env )
     and make sure it has  CLIENT_ORIGIN=https://www.tashwinfurniture.com  and  NODE_ENV=production
  2. Point a DNS A record for your API domain (e.g. api.tashwinfurniture.com) at this server's IP.
  3. Run:  bash $APP_DIR/deploy/start.sh api.tashwinfurniture.com
MSG
