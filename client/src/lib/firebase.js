import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

// Without Firebase keys the app falls back to the API's local dev login.
export const firebaseEnabled = Boolean(config.apiKey);
export const auth = firebaseEnabled ? getAuth(initializeApp(config)) : null;
