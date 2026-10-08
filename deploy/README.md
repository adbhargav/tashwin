# Hosting the API on a VPS

The storefront stays on Vercel; only `server/` runs on the VPS. Ubuntu 22.04/24.04 (or Debian 12) as root.

1. **Prepare the server and clone the code** (on the VPS):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/adbhargav/tashwin/main/deploy/setup-vps.sh | bash
   ```
2. **Copy the settings** (from your Mac, in the project folder):
   ```bash
   scp server/.env root@<server-ip>:/var/www/tashwin/server/.env
   ```
   Then on the VPS make sure `server/.env` has `CLIENT_ORIGIN=https://www.tashwinfurniture.com` and `NODE_ENV=production`.
3. **Database on the VPS (optional)** — installs PostgreSQL, copies every table from the current database and switches `.env` to it:
   ```bash
   bash /var/www/tashwin/deploy/setup-postgres.sh
   ```
   Skip this to keep using the hosted database already in `.env`.
4. **DNS:** add an A record `api.tashwinfurniture.com → <server-ip>`.
5. **Start it** (on the VPS):
   ```bash
   bash /var/www/tashwin/deploy/start.sh api.tashwinfurniture.com
   ```
6. **Point the storefront at it:** in `client/vercel.json` replace `https://tashwin.onrender.com` with `https://api.tashwinfurniture.com`, push, and update the Razorpay webhook URL to `https://api.tashwinfurniture.com/api/webhooks/razorpay`.

After each later push: `bash /var/www/tashwin/deploy/update.sh` on the VPS.
