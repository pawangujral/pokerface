// Firebase configuration and helpers
// Uses Firebase JS SDK via CDN (ES module compat bundle)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import {
    getDatabase,
    ref,
    set,
    get,
    onValue,
    update,
    remove,
    push,
    serverTimestamp,
    onDisconnect,
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js';
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import {
    getAnalytics,
    logEvent as _logEvent,
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js';

import { firebaseConfig } from './firebase-config.js';
const app = initializeApp(firebaseConfig);

// Anonymous auth — proves the user is running the real app, not a script
const auth = getAuth(app);

async function ensureAuthenticated() {
    try {
        if (auth.currentUser) {
            // Force token retrieval once so subsequent DB writes have auth context.
            await auth.currentUser.getIdToken();
            return auth.currentUser;
        }
        const cred = await signInAnonymously(auth);
        await cred.user.getIdToken();
        return cred.user;
    } catch (err) {
        console.error('Anonymous auth failed:', err.message || err);
        return null;
    }
}

const authReady = new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                await user.getIdToken();
            } catch (err) {
                console.warn('Failed to prefetch auth token:', err.message || err);
            }
            unsubscribe();
            resolve(user);
            return;
        }
        const signedInUser = await ensureAuthenticated();
        unsubscribe();
        resolve(signedInUser);
    });
});


let db;
try {
    db = getDatabase(app);
} catch (e) {
    console.error('Firebase Realtime Database failed to initialize. ' +
        'Ensure FIREBASE_DATABASE_URL is set correctly in GitHub secrets.', e.message);
    db = null;
}

let analytics = null;
try {
    analytics = getAnalytics(app);
} catch (e) {
    console.warn('Analytics unavailable (likely incognito mode):', e.message);
}

function logEvent(analyticsInstance, ...args) {
    if (analyticsInstance) _logEvent(analyticsInstance, ...args);
}

export {
    db,
    authReady,
    ensureAuthenticated,
    ref,
    set,
    get,
    onValue,
    update,
    remove,
    push,
    serverTimestamp,
    onDisconnect,
    analytics,
    logEvent,
};
