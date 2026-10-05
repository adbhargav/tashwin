// Creates (or updates) the admin-panel accounts: every ADMIN_EMAILS address gets the ADMIN_PASSWORD from .env,
// stored hashed in users.password_hash. Touches nothing else. Run: npm run seed:admin
import { migrate, pool, q } from './db.js';
import { hashPassword } from './auth.js';

const emails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const password = process.env.ADMIN_PASSWORD || '';
if (!emails.length || password.length < 8) {
  console.error('Set ADMIN_EMAILS and an ADMIN_PASSWORD of at least 8 characters in .env first.');
  process.exit(1);
}

await migrate();
for (const email of emails) {
  await q(
    `INSERT INTO users (firebase_uid, email, name, role, password_hash) VALUES ($1, $2, 'Admin', 'admin', $3)
     ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash`,
    [`admin:${email}`, email, hashPassword(password)],
  );
  console.log(`Admin ready: ${email}`);
}
await pool.end();
