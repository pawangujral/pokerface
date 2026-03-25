// Session logic — create, join, vote, reveal, reset
import {
    db, ref, set, get, onValue, update, remove, serverTimestamp, onDisconnect,
} from './firebase.js';

const FIBONACCI = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '\u2615'];

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

// ─── Session operations ───

async function createSession() {
    const sessionId = generateSessionId();
    const sessionRef = ref(db, `sessions/${sessionId}`);
    await set(sessionRef, {
        createdAt: serverTimestamp(),
        status: 'voting',
    });
    return sessionId;
}

async function sessionExists(sessionId) {
    const snap = await get(ref(db, `sessions/${sessionId}`));
    return snap.exists();
}

async function joinSession(sessionId, name) {
    const pid = getParticipantId();
    const pRef = ref(db, `sessions/${sessionId}/participants/${pid}`);
    await set(pRef, {
        name,
        vote: null,
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

async function revealVotes(sessionId) {
    const statusRef = ref(db, `sessions/${sessionId}/status`);
    await set(statusRef, 'revealed');
}

async function newRound(sessionId) {
    // Reset all votes and set status back to voting
    const snap = await get(ref(db, `sessions/${sessionId}/participants`));
    if (!snap.exists()) return;

    const updates = { [`sessions/${sessionId}/status`]: 'voting' };
    snap.forEach((child) => {
        updates[`sessions/${sessionId}/participants/${child.key}/vote`] = null;
    });
    await update(ref(db), updates);
}

async function cleanupExpiredSessions() {
    // Remove sessions older than 24 hours (best-effort on page load)
    const sessionsRef = ref(db, 'sessions');
    const snap = await get(sessionsRef);
    if (!snap.exists()) return;

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const updates = {};

    snap.forEach((child) => {
        const data = child.val();
        if (data.createdAt && now - data.createdAt > DAY) {
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
    createSession,
    sessionExists,
    joinSession,
    subscribeSession,
    castVote,
    revealVotes,
    newRound,
    cleanupExpiredSessions,
};
