// Session logic — create, join, vote, reveal, reset
import {
    db, ref, set, get, onValue, update, remove, serverTimestamp, onDisconnect,
} from './firebase.js';

const FIBONACCI = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '\u2615'];
const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

function generateSessionId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let id = '';
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    for (const byte of array) {
        id += chars[byte % chars.length];
    }
    return id;
}

function getParticipantId() {
    let id = localStorage.getItem('poker_participant_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('poker_participant_id', id);
    }
    return id;
}

function getSavedName() {
    return localStorage.getItem('poker_name') || '';
}

function saveName(name) {
    localStorage.setItem('poker_name', name);
}

function getSavedRole() {
    return localStorage.getItem('poker_role') || '';
}

function saveRole(role) {
    localStorage.setItem('poker_role', role);
}

// ─── Session operations ───

async function createSession() {
    const sessionId = generateSessionId();
    const sessionRef = ref(db, `sessions/${sessionId}`);
    await set(sessionRef, {
        createdAt: serverTimestamp(),
        expiresAt: Date.now() + SESSION_TTL_MS,
        status: 'voting',
    });
    return sessionId;
}

async function sessionExists(sessionId) {
    const snap = await get(ref(db, `sessions/${sessionId}`));
    if (!snap.exists()) return false;
    const data = snap.val();
    const expiry = data.expiresAt || (data.createdAt ? data.createdAt + SESSION_TTL_MS : 0);
    if (expiry && Date.now() > expiry) {
        // Expired — clean it up and report as non-existent
        await remove(ref(db, `sessions/${sessionId}`));
        return false;
    }
    return true;
}

async function joinSession(sessionId, name, role, spectator = false) {
    const pid = getParticipantId();
    const pRef = ref(db, `sessions/${sessionId}/participants/${pid}`);
    await set(pRef, {
        name,
        role: role || null,
        vote: null,
        spectator: spectator || false,
        joinedAt: serverTimestamp(),
    });
    // Clean up on disconnect
    onDisconnect(pRef).remove();
    return pid;
}

function subscribeSession(sessionId, callback) {
    const sessionRef = ref(db, `sessions/${sessionId}`);
    return onValue(sessionRef, (snap) => {
        callback(snap.val());
    });
}

async function castVote(sessionId, participantId, value) {
    const voteRef = ref(db, `sessions/${sessionId}/participants/${participantId}/vote`);
    await set(voteRef, value);
}

async function sendReaction(sessionId, participantId, emoji) {
    const reactRef = ref(db, `sessions/${sessionId}/reactions/${participantId}`);
    await set(reactRef, { emoji, ts: serverTimestamp() });
}

function subscribeReactions(sessionId, callback) {
    const reactRef = ref(db, `sessions/${sessionId}/reactions`);
    return onValue(reactRef, (snap) => {
        callback(snap.val());
    });
}

async function setTimer(sessionId, endsAt) {
    const timerRef = ref(db, `sessions/${sessionId}/timer`);
    await set(timerRef, endsAt);
}

async function clearTimer(sessionId) {
    const timerRef = ref(db, `sessions/${sessionId}/timer`);
    await set(timerRef, null);
}

async function revealVotes(sessionId) {
    const statusRef = ref(db, `sessions/${sessionId}/status`);
    await set(statusRef, 'revealed');
}

async function newRound(sessionId) {
    // Reset all votes and set status back to voting
    const snap = await get(ref(db, `sessions/${sessionId}/participants`));
    if (!snap.exists()) return;

    const updates = {
        [`sessions/${sessionId}/status`]: 'voting',
        [`sessions/${sessionId}/timer`]: null,
        [`sessions/${sessionId}/reactions`]: null,
    };
    snap.forEach((child) => {
        updates[`sessions/${sessionId}/participants/${child.key}/vote`] = null;
    });
    await update(ref(db), updates);
}

async function cleanupExpiredSessions() {
    // Remove sessions past their expiresAt (best-effort on page load)
    const sessionsRef = ref(db, 'sessions');
    const snap = await get(sessionsRef);
    if (!snap.exists()) return;

    const now = Date.now();
    const updates = {};

    snap.forEach((child) => {
        const data = child.val();
        // Use expiresAt if available, otherwise fall back to createdAt + TTL
        const expiry = data.expiresAt || (data.createdAt ? data.createdAt + SESSION_TTL_MS : 0);
        if (expiry && now > expiry) {
            updates[`sessions/${child.key}`] = null;
        }
    });

    if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
    }
}

export {
    FIBONACCI,
    generateSessionId,
    getParticipantId,
    getSavedName,
    saveName,
    getSavedRole,
    saveRole,
    createSession,
    sessionExists,
    joinSession,
    subscribeSession,
    castVote,
    sendReaction,
    subscribeReactions,
    setTimer,
    clearTimer,
    revealVotes,
    newRound,
    cleanupExpiredSessions,
};
