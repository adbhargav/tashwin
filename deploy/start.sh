#!/usr/bin/env bash
# Step 2 of 2 — starts the API under pm2 and puts nginx + a free HTTPS certificate in front of it.
#   bash /var/www/tashwin/deploy/start.sh api.tashwinfurniture.com
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR=/var/www/tashwin
[ -n "$DOMAIN" ] || { echo "Usage: bash deploy/start.sh <api-domain>"; exit 1; }
[ -f "$APP_DIR/server/.env" ] || { echo "Missing $APP_DIR/server/.env — copy it first."; exit 1; }
grep -q '^DATABASE_URL=postgres' "$APP_DIR/server/.env" || { echo "server/.env has no DATABASE_URL — fill in the real settings first."; exit 1; }

echo "==> Starting the API with pm2"
cd "$APP_DIR/server"
NODE_ENV=production pm2 start src/index.js --name tashwin-api --update-env --time || pm2 restart tashwin-api --update-env
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo "==> nginx site for $DOMAIN"
cat > /etc/nginx/sites-available/tashwin-api <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 64m;          # video uploads from the admin panel

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/tashwin-api /etc/nginx/sites-enabled/tashwin-api
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> HTTPS certificate (Let's Encrypt)"
if ! command -v certbot >/dev/null; then
  apt-get install -y certbot python3-certbot-nginx
fi
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || {
  echo "!! Certificate failed — usually the DNS record for $DOMAIN does not point here yet. Fix DNS and re-run this script."
}

echo
echo "API is live:  https://$DOMAIN/api/config"
echo "Logs:         pm2 logs tashwin-api"
echo "Update later: bash $APP_DIR/deploy/update.sh"
