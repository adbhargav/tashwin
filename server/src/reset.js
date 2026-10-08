import { firebaseAdminEnabled, passwordResetLink } from './firebaseAdmin.js';
import { mail } from './mail.js';
import { SITE } from './site.js';

// Sends a password-reset email. Preferred: a link generated with the Firebase service account, emailed from the
// business address. Fallback: ask Firebase to send its own email with the web API key.
// Resolves to 'own' or 'firebase'; throws only for problems the caller should see.
export async function sendPasswordReset(email, name) {
  if (firebaseAdminEnabled) {
    let link;
    try {
      link = await passwordResetLink(email, `${SITE.url}/login`);
    } catch (e) {
      if (e.code === 'auth/user-not-found') throw new Error('No account with this email');
      throw new Error(e.message);
    }
    if (!(await mail.passwordReset(email, link, name))) throw new Error('The email could not be sent — check EMAIL_USER / EMAIL_PASS on the server');
    return 'own';
  }
  const key = process.env.FIREBASE_API_KEY;
  if (!key) throw new Error('Password reset is not configured on the server (FIREBASE_API_KEY or FIREBASE_SERVICE_ACCOUNT)');
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: 'PASSWORD_RESET', email, continueUrl: `${SITE.url}/login` }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data.error?.message || '';
    throw new Error(code === 'EMAIL_NOT_FOUND' ? 'No account with this email' : code.replace(/_/g, ' ').toLowerCase() || 'Firebase request failed');
  }
  return 'firebase';
}
