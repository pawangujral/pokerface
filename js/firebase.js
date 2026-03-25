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
    getAnalytics,
    logEvent as _logEvent,
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js';

import { firebaseConfig } from './firebase-config.js';
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

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
