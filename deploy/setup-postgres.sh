#!/usr/bin/env bash
# Installs PostgreSQL on this VPS, creates the tashwin database, copies all data from the database currently in
# server/.env (e.g. Neon), and switches server/.env to the local database. Safe to re-run.
#   bash /var/www/tashwin/deploy/setup-postgres.sh
set -euo pipefail

APP_DIR=/var/www/tashwin
ENV_FILE="$APP_DIR/server/.env"
DB_NAME=tashwin
DB_USER=tashwin
CRED_FILE=/root/tashwin-database.txt

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE — copy your server/.env to the server first (scp)."; exit 1; }

echo "==> Installing PostgreSQL 17"
export DEBIAN_FRONTEND=noninteractive
if ! command -v psql >/dev/null || [ "$(psql -V | grep -oE '[0-9]+' | head -1)" -lt 17 ]; then
  apt-get install -y curl ca-certificates gnupg lsb-release
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update -y
  apt-get install -y postgresql-17 postgresql-client-17
fi
# The hosted database we copy from may be a newer major version than the local server; pg_dump must be at least as new.
apt-get install -y postgresql-client-18 >/dev/null 2>&1 || true
PG_DUMP=$(ls /usr/lib/postgresql/*/bin/pg_dump | sort -V | tail -1)
systemctl enable --now postgresql

echo "==> Database and user"
if [ -f "$CRED_FILE" ]; then
  DB_PASS=$(grep -oE 'password=.*' "$CRED_FILE" | cut -d= -f2-)
else
  DB_PASS=$(openssl rand -hex 14)
  printf 'database=%s\nuser=%s\npassword=%s\n' "$DB_NAME" "$DB_USER" "$DB_PASS" > "$CRED_FILE"
  chmod 600 "$CRED_FILE"
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER') THEN CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS'; END IF;
END \$\$;
ALTER ROLE $DB_USER PASSWORD '$DB_PASS';
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$DB_NAME')\gexec
SQL
NEW_URL="postgres://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"

OLD_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
TABLES=$(psql "$NEW_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
if [ -n "$OLD_URL" ] && [ "$OLD_URL" != "$NEW_URL" ] && [[ "$OLD_URL" != *127.0.0.1* ]] && [ "$TABLES" = "0" ]; then
  echo "==> Copying all data from the current database into the local one (this can take a minute)"
  "$PG_DUMP" "$OLD_URL" --no-owner --no-privileges --no-acl | psql -q -v ON_ERROR_STOP=1 "$NEW_URL"
  echo "    copied: $(psql "$NEW_URL" -tAc "SELECT (SELECT count(*) FROM products) || ' products, ' || (SELECT count(*) FROM orders) || ' orders, ' || (SELECT count(*) FROM users) || ' users'")"
elif [ "$TABLES" != "0" ]; then
  echo "==> Local database already has tables; not copying again."
fi

echo "==> Pointing server/.env at the local database"
cp "$ENV_FILE" "$ENV_FILE.bak-$(date +%Y%m%d%H%M%S)"
if grep -qE '^DATABASE_URL=' "$ENV_FILE"; then
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=$NEW_URL#" "$ENV_FILE"
else
  echo "DATABASE_URL=$NEW_URL" >> "$ENV_FILE"
fi

cat <<MSG

PostgreSQL is ready. Connection string saved in $CRED_FILE and written to server/.env
(a backup of the previous .env is next to it). Postgres only listens on this machine — nothing to open in the firewall.
Daily backup suggestion:  sudo -u postgres pg_dump $DB_NAME | gzip > /root/tashwin-\$(date +%F).sql.gz
MSG
