import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut,
} from 'firebase/auth';
import { auth, firebaseEnabled } from '../lib/firebase';
import { api, setTokenGetter } from '../lib/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const FRIENDLY = {
  'auth/invalid-credential': 'Incorrect email or password',
  'auth/email-already-in-use': 'An account with this email already exists',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled',
  'auth/too-many-requests': 'Too many attempts — please try again later',
};
const friendly = (e) => new Error(FRIENDLY[e.code] || e.message);

// An admin-panel session (password sign-in at /admin) takes priority over the store sign-in.
setTokenGetter(async () => {
  if (localStorage.getItem('adminToken')) return localStorage.getItem('adminToken');
  if (!firebaseEnabled) return localStorage.getItem('devToken');
  // Wait for Firebase to restore the session so the first catalogue requests already carry it (dealers get their prices).
  await auth.authStateReady();
  return auth.currentUser?.getIdToken();
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = () => api('/api/me').then(setUser).catch(() => {
    // An expired admin session must not block the store sign-in underneath it.
    if (localStorage.getItem('adminToken')) { localStorage.removeItem('adminToken'); return loadMe(); }
    setUser(null);
  });

  useEffect(() => {
    if (firebaseEnabled) {
      return onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser || localStorage.getItem('adminToken')) await loadMe(); else setUser(null);
        setLoading(false);
      });
    }
    (localStorage.getItem('devToken') || localStorage.getItem('adminToken') ? loadMe() : Promise.resolve()).then(() => setLoading(false));
  }, []);

  const value = {
    user, loading, firebaseEnabled,
    login: (email, password) => signInWithEmailAndPassword(auth, email, password).catch((e) => { throw friendly(e); }),
    google: () => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => { throw friendly(e); }),
    resetPassword: (email) => sendPasswordResetEmail(auth, email).catch((e) => { throw friendly(e); }),
    async signup(name, email, password) {
      await createUserWithEmailAndPassword(auth, email, password).catch((e) => { throw friendly(e); });
      setUser(await api('/api/me', { method: 'PUT', body: { name } }));
    },
    async devLogin(email, name) {
      const { token } = await api('/api/auth/dev-login', { method: 'POST', body: { email, name } });
      localStorage.setItem('devToken', token);
      await loadMe();
    },
    async adminLogin(email, password) {
      const { token } = await api('/api/auth/admin-login', { method: 'POST', body: { email, password } });
      localStorage.setItem('adminToken', token);
      await loadMe();
    },
    async updateProfile(data) { setUser(await api('/api/me', { method: 'PUT', body: data })); },
    async logout() {
      if (firebaseEnabled) await signOut(auth);
      localStorage.removeItem('devToken');
      localStorage.removeItem('adminToken');
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
