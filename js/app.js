// App — Router, UI wiring, and initialization
import {
    FIBONACCI,
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
} from './session.js';
import { analytics, logEvent, db, authReady } from './firebase.js';

// ─── DOM refs ───
const $landing   = document.getElementById('landing-page');
const $namePage   = document.getElementById('name-page');
const $session    = document.getElementById('session-page');

const $btnCreate     = document.getElementById('btn-create');
const $inputCode     = document.getElementById('input-session-code');
const $btnJoin       = document.getElementById('btn-join');
const $inputName     = document.getElementById('input-name');
const $btnEnter      = document.getElementById('btn-enter');
const $chkSpectator  = document.getElementById('chk-spectator');
const $roleSelector  = document.getElementById('role-selector');
const $codeDisplay   = document.getElementById('session-code-display');
const $btnCopyLink   = document.getElementById('btn-copy-link');
const $participantsContainer = document.getElementById('participants-container');
const $estCards      = document.getElementById('estimation-cards');
const $estSection    = document.getElementById('estimation-section');
const $btnReveal     = document.getElementById('btn-reveal');
const $btnNewRound   = document.getElementById('btn-new-round');
const $results       = document.getElementById('results-panel');
const $timerSelect   = document.getElementById('timer-select');
const $btnTimer      = document.getElementById('btn-timer');
const $timerBar      = document.getElementById('timer-bar');
const $timerFill     = document.getElementById('timer-fill');
const $timerText     = document.getElementById('timer-text');
const $btnTimerStop  = document.getElementById('btn-timer-stop');
const $reactionsBar  = document.getElementById('reactions-bar');
const $reactionFloats = document.getElementById('reaction-floats');
const $spectatorWaiting = document.getElementById('spectator-waiting');
const $spectatorRingProgress = document.getElementById('spectator-ring-progress');
const $spectatorVotedCount = document.getElementById('spectator-voted-count');
const $spectatorTotalCount = document.getElementById('spectator-total-count');
const $spectatorHeadline = document.getElementById('spectator-headline');
const $spectatorAvatars = document.getElementById('spectator-avatars');
const $spectatorRoleStatus = document.getElementById('spectator-role-status');
const $confetti      = document.getElementById('confetti-canvas');

let currentSessionId = null;
let currentPid       = null;
let unsubscribe      = null;
let unsubReactions   = null;
let selectedRole     = '';
let isSpectator      = false;
let timerInterval    = null;
let timerDuration    = 0;

// ─── Role selection ───
function updateEnterButton() {
    const name = $inputName.value.trim();
    $btnEnter.disabled = !(name && selectedRole);
}

$roleSelector.addEventListener('click', (e) => {
    const chip = e.target.closest('.role-chip');
    if (!chip) return;
    $roleSelector.querySelectorAll('.role-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedRole = chip.dataset.role;
    updateEnterButton();
});

$inputName.addEventListener('input', updateEnterButton);

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
    FIBONACCI.forEach((val, idx) => {
        const card = document.createElement('div');
        card.className = 'est-card';
        card.textContent = val;
        if (val === selectedValue) card.classList.add('selected');
        if (disabled || isSpectator) card.classList.add('disabled');
        card.dataset.index = idx;
        card.addEventListener('click', () => onVote(val));
        $estCards.appendChild(card);
    });
}

// ─── Render participants ───
const ROLE_ORDER = ['Developer', 'QA', 'DevOps/SRE', 'Designer', 'Business'];

function renderParticipants(participants, status) {
    $participantsContainer.innerHTML = '';
    if (!participants) return;

    const entries = Object.entries(participants);
    entries.sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));

    // Split voters and spectators
    const voters = entries.filter(([, d]) => !d.spectator);
    const spectators = entries.filter(([, d]) => d.spectator);

    // Group voters by role
    const groups = {};
    voters.forEach(([pid, data]) => {
        const role = data.role || 'Other';
        if (!groups[role]) groups[role] = [];
        groups[role].push([pid, data]);
    });

    const orderedRoles = [...ROLE_ORDER.filter(r => groups[r]), ...Object.keys(groups).filter(r => !ROLE_ORDER.includes(r))];

    orderedRoles.forEach(role => {
        const panel = document.createElement('div');
        panel.className = 'participants-panel';

        const header = document.createElement('h3');
        header.textContent = `${role} (${groups[role].length})`;
        panel.appendChild(header);

        const ul = document.createElement('ul');
        ul.className = 'participants-list';

        groups[role].forEach(([pid, data]) => {
            ul.appendChild(buildParticipantLi(pid, data, status));
        });

        panel.appendChild(ul);
        $participantsContainer.appendChild(panel);
    });

    // Spectators panel
    if (spectators.length > 0) {
        const panel = document.createElement('div');
        panel.className = 'participants-panel spectator-panel';

        const header = document.createElement('h3');
        header.textContent = `Spectators (${spectators.length})`;
        panel.appendChild(header);

        const ul = document.createElement('ul');
        ul.className = 'participants-list';

        spectators.forEach(([pid, data]) => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'participant-name';
            if (pid === currentPid) nameSpan.classList.add('is-you');
            nameSpan.textContent = data.name + (pid === currentPid ? ' (you)' : '');

            const badge = document.createElement('span');
            badge.className = 'vote-badge spectator-badge';
            badge.textContent = '👁';

            li.appendChild(nameSpan);
            li.appendChild(badge);
            ul.appendChild(li);
        });

        panel.appendChild(ul);
        $participantsContainer.appendChild(panel);
    }
}

function buildParticipantLi(pid, data, status) {
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
    return li;
}

// ─── Compute stats after reveal ───
function getStats(voterList) {
    const numericVotes = [];
    voterList.forEach(p => {
        if (p.spectator) return;
        const n = parseFloat(p.vote);
        if (!isNaN(n)) numericVotes.push(n);
    });

    if (numericVotes.length === 0) return { avg: '-', consensus: '-', consensusColor: '' };

    const avg = numericVotes.reduce((s, v) => s + v, 0) / numericVotes.length;
    const avgText = avg % 1 === 0 ? String(avg) : avg.toFixed(1);

    const unique = [...new Set(numericVotes)];
    let consensus, consensusColor;
    if (unique.length === 1) {
        consensus = '\u2705 Agreement';
        consensusColor = '#22c55e';
    } else {
        const spread = Math.max(...numericVotes) - Math.min(...numericVotes);
        if (spread <= 3) {
            consensus = '\u2248 Close';
            consensusColor = '#f59e0b';
        } else {
            consensus = '\u26a0 Discuss';
            consensusColor = '#ef4444';
        }
    }

    return { avg: avgText, consensus, consensusColor, isAgreement: unique.length === 1 };
}

function buildStatCard(label, stats) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const title = document.createElement('h4');
    title.className = 'result-card-title';
    title.textContent = label;
    card.appendChild(title);

    const row = document.createElement('div');
    row.className = 'result-card-stats';

    const avgDiv = document.createElement('div');
    avgDiv.className = 'result-stat';
    avgDiv.innerHTML = `<span class="stat-label">${stats.avgLabel || 'Average'}</span><span class="stat-value">${stats.avg}</span>`;
    row.appendChild(avgDiv);

    if (stats.consensus) {
        const consDiv = document.createElement('div');
        consDiv.className = 'result-stat';
        const consLabel = document.createElement('span');
        consLabel.className = 'stat-label';
        consLabel.textContent = 'Consensus';
        const consText = document.createElement('span');
        consText.className = 'stat-value';
        consText.textContent = stats.consensus;
        if (stats.consensusColor) consText.style.color = stats.consensusColor;
        consDiv.appendChild(consLabel);
        consDiv.appendChild(consText);
        row.appendChild(consDiv);
    }

    card.appendChild(row);
    return card;
}

function computeStats(participants) {
    $results.innerHTML = '';
    const all = Object.values(participants || {}).filter(p => !p.spectator);

    // Group by role
    const groups = {};
    all.forEach(p => {
        const role = p.role || 'Other';
        if (!groups[role]) groups[role] = [];
        groups[role].push(p);
    });

    const orderedRoles = [...ROLE_ORDER.filter(r => groups[r]), ...Object.keys(groups).filter(r => !ROLE_ORDER.includes(r))];

    const roleStats = {};
    let total = 0;
    let hasAnyVotes = false;
    let allAgreement = true;

    orderedRoles.forEach(role => {
        const stats = getStats(groups[role]);
        roleStats[role] = stats;
        if (stats.avg !== '-') {
            total += parseFloat(stats.avg);
            hasAnyVotes = true;
        }
        if (!stats.isAgreement) allAgreement = false;
    });

    if (orderedRoles.length > 1) {
        const totalText = !hasAnyVotes ? '-' : (total % 1 === 0 ? String(total) : total.toFixed(1));
        $results.appendChild(buildStatCard('Total Estimate', { avg: totalText, avgLabel: 'Points', consensus: '', consensusColor: '' }));
        orderedRoles.forEach(role => {
            $results.appendChild(buildStatCard(role, roleStats[role]));
        });
    } else {
        orderedRoles.forEach(role => {
            $results.appendChild(buildStatCard(role, roleStats[role]));
        });
    }

    // Confetti on full agreement
    if (hasAnyVotes && allAgreement && all.length > 1) {
        launchConfetti();
    }
}

// ─── Spectator progress ───
const RING_CIRCUMFERENCE = 326.73; // 2 * PI * 52

function updateSpectatorProgress(participants) {
    const entries = Object.entries(participants || {});
    const voterEntries = entries.filter(([, p]) => !p.spectator);
    const voted = voterEntries.filter(([, p]) => p.vote != null).length;
    const total = voterEntries.length;
    const allDone = voted === total && total > 0;

    // Ring progress
    const pct = total > 0 ? voted / total : 0;
    const offset = RING_CIRCUMFERENCE * (1 - pct);
    $spectatorRingProgress.style.strokeDashoffset = offset;
    $spectatorRingProgress.classList.toggle('all-voted', allDone);

    // Counter
    $spectatorVotedCount.textContent = voted;
    $spectatorVotedCount.classList.toggle('all-voted', allDone);
    $spectatorTotalCount.textContent = total;

    // Headline
    if (total === 0) {
        $spectatorHeadline.textContent = 'No voters yet...';
    } else if (allDone) {
        $spectatorHeadline.textContent = 'All votes are in!';
    } else {
        const remaining = total - voted;
        $spectatorHeadline.textContent = remaining === 1
            ? '1 person still deciding...'
            : `${remaining} people still deciding...`;
    }

    // Voter avatar bubbles
    $spectatorAvatars.innerHTML = '';
    voterEntries.forEach(([, p]) => {
        const av = document.createElement('div');
        av.className = 'spectator-avatar' + (p.vote != null ? ' voted' : '');
        // Initials from name
        const parts = (p.name || '?').trim().split(/\s+/);
        const initials = parts.length >= 2
            ? parts[0][0] + parts[parts.length - 1][0]
            : parts[0].slice(0, 2);
        av.textContent = initials;
        av.title = p.name || 'Voter';
        $spectatorAvatars.appendChild(av);
    });

    // Per-role chips
    const groups = {};
    voterEntries.forEach(([, p]) => {
        const role = p.role || 'Other';
        if (!groups[role]) groups[role] = { voted: 0, total: 0 };
        groups[role].total++;
        if (p.vote != null) groups[role].voted++;
    });

    const orderedRoles = [...ROLE_ORDER.filter(r => groups[r]), ...Object.keys(groups).filter(r => !ROLE_ORDER.includes(r))];
    $spectatorRoleStatus.innerHTML = '';
    orderedRoles.forEach(role => {
        const g = groups[role];
        const chip = document.createElement('span');
        chip.className = 'spectator-role-chip' + (g.voted === g.total ? ' complete' : '');
        chip.innerHTML = `<span class="chip-dot"></span>${role} <span class="chip-count">${g.voted}/${g.total}</span>`;
        $spectatorRoleStatus.appendChild(chip);
    });
}

// ─── Confetti ───
function launchConfetti() {
    const ctx = $confetti.getContext('2d');
    $confetti.width = window.innerWidth;
    $confetti.height = window.innerHeight;
    $confetti.style.display = 'block';

    const pieces = [];
    const colors = ['#6366f1', '#818cf8', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

    for (let i = 0; i < 150; i++) {
        pieces.push({
            x: Math.random() * $confetti.width,
            y: Math.random() * $confetti.height - $confetti.height,
            w: Math.random() * 8 + 4,
            h: Math.random() * 6 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 3 + 2,
            rot: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10,
        });
    }

    let frame = 0;
    function draw() {
        ctx.clearRect(0, 0, $confetti.width, $confetti.height);
        let alive = false;
        pieces.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.rot += p.rotSpeed;
            if (p.y < $confetti.height + 20) alive = true;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rot * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });

        frame++;
        if (alive && frame < 300) {
            requestAnimationFrame(draw);
        } else {
            ctx.clearRect(0, 0, $confetti.width, $confetti.height);
            $confetti.style.display = 'none';
        }
    }
    requestAnimationFrame(draw);
}

// ─── Timer ───
function startTimerDisplay(endsAt) {
    clearInterval(timerInterval);
    $timerBar.classList.remove('hidden');

    const totalMs = endsAt - Date.now();
    if (totalMs <= 0) {
        $timerBar.classList.add('hidden');
        return;
    }
    timerDuration = totalMs;

    function tick() {
        const remaining = Math.max(0, endsAt - Date.now());
        const secs = Math.ceil(remaining / 1000);
        const mins = Math.floor(secs / 60);
        $timerText.textContent = `${mins}:${String(secs % 60).padStart(2, '0')}`;

        const pct = (remaining / timerDuration) * 100;
        $timerFill.style.width = `${pct}%`;

        if (pct > 50) $timerFill.className = 'timer-fill';
        else if (pct > 20) $timerFill.className = 'timer-fill timer-warn';
        else $timerFill.className = 'timer-fill timer-danger';

        if (remaining <= 0) {
            clearInterval(timerInterval);
            $timerText.textContent = "Time's up!";
            $timerFill.style.width = '0%';
            setTimeout(() => $timerBar.classList.add('hidden'), 3000);
        }
    }

    tick();
    timerInterval = setInterval(tick, 250);
}

$btnTimer.addEventListener('click', () => {
    const secs = parseInt($timerSelect.value);
    if (!secs || !currentSessionId) return;
    const endsAt = Date.now() + secs * 1000;
    setTimer(currentSessionId, endsAt);
});

$btnTimerStop.addEventListener('click', () => {
    if (!currentSessionId) return;
    clearInterval(timerInterval);
    $timerBar.classList.add('hidden');
    clearTimer(currentSessionId);
});

// ─── Emoji reactions ───
const seenReactions = new Set();

$reactionsBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.reaction-btn');
    if (!btn || !currentSessionId || !currentPid) return;
    sendReaction(currentSessionId, currentPid, btn.dataset.emoji);
});

function onReactionsUpdate(data) {
    if (!data) return;
    Object.entries(data).forEach(([pid, r]) => {
        const key = `${pid}_${r.ts}`;
        if (seenReactions.has(key)) return;
        seenReactions.add(key);
        spawnFloatingEmoji(r.emoji);
    });
}

function spawnFloatingEmoji(emoji) {
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.textContent = emoji;
    el.style.left = `${20 + Math.random() * 60}%`;
    $reactionFloats.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

// ─── Keyboard shortcuts ───
// Map keys to FIBONACCI values: 0-9 map to card indices, r=reveal, n=new round
const KEY_MAP = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
    '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

document.addEventListener('keydown', (e) => {
    // Don't capture when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    // Only on session page
    if ($session.classList.contains('hidden')) return;
    if (isSpectator) return;

    const idx = KEY_MAP[e.key];
    if (idx !== undefined && idx < FIBONACCI.length) {
        e.preventDefault();
        onVote(FIBONACCI[idx]);
        return;
    }

    if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (currentSessionId && !$btnReveal.disabled) {
            logEvent(analytics, 'votes_revealed');
            revealVotes(currentSessionId);
        }
    }
    if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (currentSessionId) newRound(currentSessionId);
    }
});

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
    const myData = participants[currentPid];
    const myVote = myData?.vote ?? null;

    // Update UI elements
    $btnReveal.textContent = status === 'revealed' ? 'Votes Shown' : 'Show Votes';
    $btnReveal.disabled = status === 'revealed';

    renderParticipants(participants, status);
    renderEstCards(myVote, status === 'revealed');

    // Timer
    if (data.timer) {
        startTimerDisplay(data.timer);
    } else {
        clearInterval(timerInterval);
        $timerBar.classList.add('hidden');
    }

    // Spectator: hide voting UI, show waiting view
    if (isSpectator) {
        $estSection.classList.add('hidden');
        if (status !== 'revealed') {
            $spectatorWaiting.classList.remove('hidden');
            updateSpectatorProgress(participants);
        } else {
            $spectatorWaiting.classList.add('hidden');
        }
    } else {
        $estSection.classList.remove('hidden');
        $spectatorWaiting.classList.add('hidden');
    }

    // Reactions bar + results
    if (status === 'revealed') {
        $results.classList.remove('hidden');
        $reactionsBar.classList.remove('hidden');
        computeStats(participants);
    } else {
        $results.classList.add('hidden');
        $reactionsBar.classList.add('hidden');
        seenReactions.clear();
    }
}

// ─── Event handlers ───
async function onVote(value) {
    if (!currentSessionId || !currentPid || isSpectator) return;
    logEvent(analytics, 'vote_cast', { value });
    await castVote(currentSessionId, currentPid, value);
}

async function enterSession(sessionId) {
    currentSessionId = sessionId;
    $codeDisplay.textContent = sessionId;
    setHash(sessionId);

    const name = getSavedName();
    const role = getSavedRole();
    if (!name || !role) {
        showPage($namePage);
        $inputName.focus();
        if (role) {
            selectedRole = role;
            const chip = $roleSelector.querySelector(`[data-role="${role}"]`);
            if (chip) chip.classList.add('active');
        }
        updateEnterButton();
        return;
    }

    selectedRole = role;
    currentPid = getParticipantId();
    isSpectator = localStorage.getItem('poker_spectator') === 'true';
    await joinSession(sessionId, name, role, isSpectator);
    showPage($session);

    if (unsubscribe) unsubscribe();
    unsubscribe = subscribeSession(sessionId, onSessionUpdate);
    if (unsubReactions) unsubReactions();
    unsubReactions = subscribeReactions(sessionId, onReactionsUpdate);
}

$btnCreate.addEventListener('click', async () => {
    if (!db) {
        toast('Firebase is not configured. Check deployment secrets.');
        return;
    }
    $btnCreate.disabled = true;
    try {
        const user = await authReady;
        if (!user) {
            toast('Authentication failed. Please refresh and try again.');
            return;
        }
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
    const user = await authReady;
    if (!user) { toast('Authentication failed. Please refresh.'); return; }
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
    if (!selectedRole) { toast('Choose your role'); return; }
    saveName(name);
    saveRole(selectedRole);
    isSpectator = $chkSpectator.checked;
    localStorage.setItem('poker_spectator', isSpectator);
    currentPid = getParticipantId();
    await joinSession(currentSessionId, name, selectedRole, isSpectator);
    showPage($session);
    if (unsubscribe) unsubscribe();
    unsubscribe = subscribeSession(currentSessionId, onSessionUpdate);
    if (unsubReactions) unsubReactions();
    unsubReactions = subscribeReactions(currentSessionId, onReactionsUpdate);
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
    $inputName.value = getSavedName();
    const savedRole = getSavedRole();
    if (savedRole) {
        selectedRole = savedRole;
        const chip = $roleSelector.querySelector(`[data-role="${savedRole}"]`);
        if (chip) chip.classList.add('active');
    }
    $chkSpectator.checked = localStorage.getItem('poker_spectator') === 'true';

    // Wait for anonymous auth before any database operations
    await authReady;

    cleanupExpiredSessions().catch(() => {});

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
        if (unsubReactions) unsubReactions();
        showPage($landing);
    }
});

init();
