import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  update,
  remove,
  serverTimestamp,
  onDisconnect,
} from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { getAnalytics, logEvent as _logEvent, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);

let db: ReturnType<typeof getDatabase>;
try {
  db = getDatabase(app);
} catch (e) {
  console.error('Firebase Realtime Database failed to initialize:', e);
  throw e;
}

async function ensureAuthenticated() {
  try {
    if (auth.currentUser) {
      await auth.currentUser.getIdToken();
      return auth.currentUser;
    }
    const cred = await signInAnonymously(auth);
    await cred.user.getIdToken();
    return cred.user;
  } catch (err) {
    console.error('Anonymous auth failed:', err);
    return null;
  }
}

const authReady = new Promise<User | null>((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      try { await user.getIdToken(); } catch { /* non-fatal */ }
      unsubscribe();
      resolve(user);
      return;
    }
    const signedIn = await ensureAuthenticated();
    unsubscribe();
    resolve(signedIn);
  });
});

let analyticsInstance: Awaited<ReturnType<typeof getAnalytics>> | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((ok) => {
    if (ok) analyticsInstance = getAnalytics(app);
  }).catch(() => { /* incognito / blocked */ });
}

function logEvent(eventName: string, params?: Record<string, unknown>) {
  if (analyticsInstance) _logEvent(analyticsInstance, eventName, params);
}

export {
  db,
  auth,
  authReady,
  ensureAuthenticated,
  logEvent,
  ref,
  set,
  get,
  onValue,
  update,
  remove,
  serverTimestamp,
  onDisconnect,
};
