import 'dotenv/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Firebase's own reset emails come from noreply@<project>.firebaseapp.com and are often filtered as spam.
// With a service account (FIREBASE_SERVICE_ACCOUNT = the JSON key, Project settings > Service accounts) the server
// generates the reset link itself and emails it from the business address instead.
let auth = null;
try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const creds = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    auth = getAuth(getApps()[0] || initializeApp({ credential: cert(creds) }));
  }
} catch (e) { console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON:', e.message); }

export const firebaseAdminEnabled = Boolean(auth);
export const passwordResetLink = (email, continueUrl) => auth.generatePasswordResetLink(email, { url: continueUrl });
