import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
export const pool = new pg.Pool({
  connectionString: url,
  // Neon (and most hosted Postgres) require TLS; local Postgres does not.
  // Reconnecting to a remote database costs seconds, so keep idle connections open instead of the 10s default.
  idleTimeoutMillis: 10 * 60 * 1000,
  keepAlive: true,
  ssl: /neon\.tech|sslmode=require/.test(url || '') ? { rejectUnauthorized: false } : undefined,
});

export const q = (text, params) => pool.query(text, params).then((r) => r.rows);
export const one = (text, params) => q(text, params).then((rows) => rows[0]);

export async function migrate() {
  await pool.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
}

export const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
