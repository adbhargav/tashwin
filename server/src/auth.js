import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { one } from './db.js';
import { mail } from './mail.js';

const projectId = process.env.FIREBASE_PROJECT_ID;
const isProd = process.env.NODE_ENV === 'production';
// Dev login exists only so the app is usable before Firebase keys are added. Never active in production.
export const devAuthEnabled = !projectId && !isProd;
const devSecret = new TextEncoder().encode(process.env.DEV_JWT_SECRET || 'tashwin-local-dev-only');
const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);
const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

// Password sign-in for the admin panel (/admin). Passwords live hashed in users.password_hash — see seed-admin.js.
const adminSecret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || '');
export const adminLoginEnabled = adminSecret.length >= 32;
const ADMIN_ISSUER = 'tashwin-admin';

export const hashPassword = (password, salt = randomBytes(16).toString('hex')) =>
  `${salt}:${scryptSync(String(password), salt, 64).toString('hex')}`;

export async function checkAdminLogin(email, password) {
  if (!adminLoginEnabled) return false;
  const user = await one(`SELECT password_hash FROM users WHERE email = $1 AND role = 'admin'`, [email]);
  if (!user?.password_hash) return false;
  const expected = Buffer.from(user.password_hash);
  const given = Buffer.from(hashPassword(password, user.password_hash.split(':')[0]));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
export const signAdminToken = (email) =>
  new SignJWT({ email, name: 'Admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(ADMIN_ISSUER).setSubject(`admin:${email}`).setExpirationTime('12h').sign(adminSecret);

export const signDevToken = (email, name) =>
  new SignJWT({ email, name }).setProtectedHeader({ alg: 'HS256' }).setSubject(`dev:${email}`).setExpirationTime('7d').sign(devSecret);

async function verifyToken(token) {
  if (adminLoginEnabled) {
    try { return (await jwtVerify(token, adminSecret, { issuer: ADMIN_ISSUER })).payload; } catch { /* not an admin token */ }
  }
  if (projectId) {
    const { payload } = await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    return payload;
  }
  if (devAuthEnabled) return (await jwtVerify(token, devSecret)).payload;
  throw new Error('Auth is not configured');
}

export async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'Sign in required' });
  let claims;
  try {
    claims = await verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
  if (!claims.email) return res.status(401).json({ error: 'Account has no email' });
  const email = claims.email.toLowerCase();
  const role = adminEmails.includes(email) ? 'admin' : 'customer';
  // Upsert by email so the same person keeps one account across Google and password sign-in.
  req.user = await one(
    `INSERT INTO users (firebase_uid, email, name, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid,
       role = CASE WHEN $4 = 'admin' THEN 'admin' ELSE users.role END
     RETURNING *, (xmax = 0) AS is_new`,
    [claims.sub, email, claims.name || '', role],
  );
  delete req.user.password_hash;
  if (req.user.is_new) mail.welcome(req.user);
  next();
}

// Catalogue routes are public, but dealers see their own prices, so a valid token's role is looked up when present.
// Roles are remembered for a minute to keep the cached catalogue fast; an admin role change clears this.
const roles = new Map();
export const clearRoleCache = () => roles.clear();
export async function viewer(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (token) {
    try {
      const email = (await verifyToken(token)).email?.toLowerCase();
      let hit = roles.get(email);
      if (email && !(hit?.expires > Date.now())) {
        hit = { role: (await one(`SELECT role FROM users WHERE email = $1`, [email]))?.role, expires: Date.now() + 60 * 1000 };
        roles.set(email, hit);
      }
      req.dealer = hit?.role === 'dealer';
    } catch { /* an invalid or expired token just browses as a guest */ }
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
  next();
}
