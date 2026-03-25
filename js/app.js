// App — Router, UI wiring, and initialization
import {
    FIBONACCI,
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
} from './session.js';
import { analytics, logEvent, db } from './firebase.js';

// ─── DOM refs ───
const $landing   = document.getElementById('landing-page');
const $namePage   = document.getElementById('name-page');
const $session    = document.getElementById('session-page');

const $btnCreate     = document.getElementById('btn-create');
const $inputCode     = document.getElementById('input-session-code');
const $btnJoin       = document.getElementById('btn-join');
const $inputName     = document.getElementById('input-name');
const $btnEnter      = document.getElementById('btn-enter');
const $codeDisplay   = document.getElementById('session-code-display');
const $btnCopyLink   = document.getElementById('btn-copy-link');
const $participants  = document.getElementById('participants-list');
const $estCards      = document.getElementById('estimation-cards');
const $btnReveal     = document.getElementById('btn-reveal');
const $btnNewRound   = document.getElementById('btn-new-round');
const $results       = document.getElementById('results-panel');
const $avgStat       = document.getElementById('stat-average');
const $consStat      = document.getElementById('stat-consensus');

let currentSessionId = null;
let currentPid       = null;
let unsubscribe      = null;

// ─── Helpers ───
function showPage(page) {
    [$landing, $namePage, $session].forEach(p => p.classList.add('hidden'));
    page.classList.remove('hidden');
}

function toast(msg) {
    const $t = document.getElementById('toast');
    $t.textContent = msg;
    $t.classList.remove('hidden');
    clearTimeout($t._timer);
    $t._timer = setTimeout(() => $t.classList.add('hidden'), 2500);
}

function getSessionIdFromHash() {
    const match = location.hash.match(/^#\/session\/(.+)$/);
    return match ? match[1] : null;
}

function setHash(sessionId) {
    location.hash = `#/session/${sessionId}`;
}

// ─── Render estimation cards ───
function renderEstCards(selectedValue, disabled) {
    $estCards.innerHTML = '';
    FIBONACCI.forEach(val => {
        const card = document.createElement('div');
        card.className = 'est-card';
        card.textContent = val;
        if (val === selectedValue) card.classList.add('selected');
        if (disabled) card.classList.add('disabled');
        card.addEventListener('click', () => onVote(val));
        $estCards.appendChild(card);
    });
}

// ─── Render participants ───
function renderParticipants(participants, status) {
    $participants.innerHTML = '';
    if (!participants) return;

    const entries = Object.entries(participants);
    entries.sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));

    entries.forEach(([pid, data]) => {
        const li = document.createElement('li');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'participant-name';
        if (pid === currentPid) nameSpan.classList.add('is-you');
        nameSpan.textContent = data.name + (pid === currentPid ? ' (you)' : '');

        const badge = document.createElement('span');
        badge.className = 'vote-badge';

        if (status === 'revealed') {
            badge.classList.add('revealed');
            badge.textContent = data.vote != null ? data.vote : '-';
        } else if (data.vote != null) {
            badge.classList.add('voted');
            badge.textContent = '\u2713';
        } else {
            badge.classList.add('not-voted');
            badge.textContent = '\u2026';
        }

        li.appendChild(nameSpan);
        li.appendChild(badge);
        $participants.appendChild(li);
    });
}

// ─── Compute stats after reveal ───
function computeStats(participants) {
    const numericVotes = [];
    Object.values(participants || {}).forEach(p => {
        const n = parseFloat(p.vote);
        if (!isNaN(n)) numericVotes.push(n);
    });

    if (numericVotes.length === 0) {
        $avgStat.textContent = '-';
        $consStat.textContent = '-';
        return;
    }

    const avg = numericVotes.reduce((s, v) => s + v, 0) / numericVotes.length;
    $avgStat.textContent = avg % 1 === 0 ? avg : avg.toFixed(1);

    const unique = [...new Set(numericVotes)];
    if (unique.length === 1) {
        $consStat.textContent = '\u2705 Agreement';
        $consStat.style.color = '#22c55e';
    } else {
        const spread = Math.max(...numericVotes) - Math.min(...numericVotes);
        if (spread <= 3) {
            $consStat.textContent = '\u2248 Close';
            $consStat.style.color = '#f59e0b';
        } else {
            $consStat.textContent = '\u26a0 Discuss';
            $consStat.style.color = '#ef4444';
        }
    }
}

// ─── Session state callback ───
function onSessionUpdate(data) {
    if (!data) {
        toast('Session no longer exists');
        location.hash = '';
        showPage($landing);
        return;
    }

    const status = data.status || 'voting';
    const participants = data.participants || {};
    const myVote = participants[currentPid]?.vote ?? null;

    // Update UI elements
    $btnReveal.textContent = status === 'revealed' ? 'Votes Shown' : 'Show Votes';
    $btnReveal.disabled = status === 'revealed';

    renderParticipants(participants, status);
    renderEstCards(myVote, status === 'revealed');

    if (status === 'revealed') {
        $results.classList.remove('hidden');
        computeStats(participants);
    } else {
        $results.classList.add('hidden');
    }
}

// ─── Event handlers ───
async function onVote(value) {
    if (!currentSessionId || !currentPid) return;
    logEvent(analytics, 'vote_cast', { value });
    await castVote(currentSessionId, currentPid, value);
}

async function enterSession(sessionId) {
    currentSessionId = sessionId;
    $codeDisplay.textContent = sessionId;
    setHash(sessionId);

    const name = getSavedName();
    if (!name) {
        showPage($namePage);
        $inputName.focus();
        return;
    }

    currentPid = getParticipantId();
    await joinSession(sessionId, name);
    showPage($session);

    if (unsubscribe) unsubscribe();
    unsubscribe = subscribeSession(sessionId, onSessionUpdate);
}

$btnCreate.addEventListener('click', async () => {
    if (!db) {
        toast('Firebase is not configured. Check deployment secrets.');
        return;
    }
    $btnCreate.disabled = true;
    try {
        const id = await createSession();
        logEvent(analytics, 'session_created', { session_id: id });
        await enterSession(id);
    } catch (e) {
        toast('Failed to create session');
        console.error(e);
    } finally {
        $btnCreate.disabled = false;
    }
});

$btnJoin.addEventListener('click', async () => {
    const code = $inputCode.value.trim();
    if (!code) { toast('Enter a session code'); return; }
    const exists = await sessionExists(code);
    if (!exists) { toast('Session not found'); return; }
    logEvent(analytics, 'session_joined', { session_id: code });
    await enterSession(code);
});

$inputCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $btnJoin.click();
});

$btnEnter.addEventListener('click', async () => {
    const name = $inputName.value.trim();
    if (!name) { toast('Enter your name'); return; }
    saveName(name);
    currentPid = getParticipantId();
    await joinSession(currentSessionId, name);
    showPage($session);
    if (unsubscribe) unsubscribe();
    unsubscribe = subscribeSession(currentSessionId, onSessionUpdate);
});

$inputName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $btnEnter.click();
});

$btnReveal.addEventListener('click', () => {
    if (currentSessionId) {
        logEvent(analytics, 'votes_revealed');
        revealVotes(currentSessionId);
    }
});

$btnNewRound.addEventListener('click', () => {
    if (currentSessionId) newRound(currentSessionId);
});

$btnCopyLink.addEventListener('click', () => {
    const url = `${location.origin}${location.pathname}#/session/${currentSessionId}`;
    navigator.clipboard.writeText(url).then(() => toast('Link copied!'));
});

// ─── Router / Init ───
async function init() {
    // Pre-fill saved name
    $inputName.value = getSavedName();

    // Best-effort cleanup
    cleanupExpiredSessions().catch(() => {});

    // Check URL for existing session
    const hashId = getSessionIdFromHash();
    if (hashId) {
        const exists = await sessionExists(hashId);
        if (exists) {
            await enterSession(hashId);
            return;
        }
        toast('Session not found');
        location.hash = '';
    }

    showPage($landing);
}

window.addEventListener('hashchange', async () => {
    const hashId = getSessionIdFromHash();
    if (hashId && hashId !== currentSessionId) {
        const exists = await sessionExists(hashId);
        if (exists) {
            await enterSession(hashId);
        } else {
            toast('Session not found');
            location.hash = '';
            showPage($landing);
        }
    } else if (!hashId) {
        if (unsubscribe) unsubscribe();
        showPage($landing);
    }
});

init();
