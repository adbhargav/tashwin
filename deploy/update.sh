#!/usr/bin/env bash
# Pulls the latest code from GitHub and restarts the API. Run after every push.
set -euo pipefail
cd /var/www/tashwin
git pull --ff-only
cd server && npm ci --omit=dev
pm2 restart tashwin-api --update-env
pm2 logs tashwin-api --lines 20 --nostream
