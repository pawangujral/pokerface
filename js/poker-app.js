// Poker App — Casino Edition
// Reuses session.js + firebase.js, renders a poker table UI
import * as session from './session.js';
import * as firebase from './firebase.js';

const FIBONACCI = session.FIBONACCI ?? session.default?.FIBONACCI ?? ['0', '1', '2', '3', '5', '8', '13', '21', '?', '\u2615'];
const getParticipantId = session.getParticipantId ?? session.default?.getParticipantId;
const getSavedName = session.getSavedName ?? session.default?.getSavedName;
const saveName = session.saveName ?? session.default?.saveName;
const getSavedRole = session.getSavedRole ?? session.default?.getSavedRole;
const saveRole = session.saveRole ?? session.default?.saveRole;
const createSession = session.createSession ?? session.default?.createSession;
const sessionExists = session.sessionExists ?? session.default?.sessionExists;
const joinSession = session.joinSession ?? session.default?.joinSession;
const subscribeSession = session.subscribeSession ?? session.default?.subscribeSession;
const castVote = session.castVote ?? session.default?.castVote;
const sendReaction = session.sendReaction ?? session.default?.sendReaction;
const subscribeReactions = session.subscribeReactions ?? session.default?.subscribeReactions;
const setTimer = session.setTimer ?? session.default?.setTimer;
const clearTimer = session.clearTimer ?? session.default?.clearTimer;
const revealVotes = session.revealVotes ?? session.default?.revealVotes;
const newRound = session.newRound ?? session.default?.newRound;
const cleanupExpiredSessions = session.cleanupExpiredSessions ?? session.default?.cleanupExpiredSessions;

const analytics = firebase.analytics ?? firebase.default?.analytics ?? null;
const logEvent = firebase.logEvent ?? firebase.default?.logEvent ?? (() => {});
const db = firebase.db ?? firebase.default?.db ?? null;
const authReady = firebase.authReady ?? firebase.default?.authReady ?? Promise.resolve(null);
const ensureAuthenticated = firebase.ensureAuthenticated ?? firebase.default?.ensureAuthenticated ?? (async () => authReady);

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
const $btnSoundSettings = document.getElementById('btn-sound-settings');
const $soundPopover = document.getElementById('sound-popover');
const $btnSoundMute = document.getElementById('btn-sound-mute');
const $btnSoundProfileNext = document.getElementById('btn-sound-profile-next');
const $inputSoundVolume = document.getElementById('input-sound-volume');
const $soundVolumeValue = document.getElementById('sound-volume-value');
const $chkAmbient = document.getElementById('chk-ambient-sound');
const $handCards     = document.getElementById('hand-cards');
const $handSection   = document.getElementById('hand-section');
const $btnReveal     = document.getElementById('btn-reveal');
const $btnNewRound   = document.getElementById('btn-new-round');
const $tableBets     = document.getElementById('table-bets');
const $potArea       = document.getElementById('pot-area');
const $potResults    = document.getElementById('pot-results');
const $timerSelect   = document.getElementById('timer-select');
const $btnTimer      = document.getElementById('btn-timer');
const $timerBar      = document.getElementById('timer-bar');
const $timerFill     = document.getElementById('timer-fill');
const $timerText     = document.getElementById('timer-text');
const $btnTimerStop  = document.getElementById('btn-timer-stop');
const $reactionsBar  = document.getElementById('reactions-bar');
const $reactionFloats = document.getElementById('reaction-floats');
const $seatsContainer = document.getElementById('seats-container');
const $spectatorWaiting = document.getElementById('spectator-waiting');
const $spectatorRingProgress = document.getElementById('spectator-ring-progress');
const $spectatorVotedCount = document.getElementById('spectator-voted-count');
const $spectatorTotalCount = document.getElementById('spectator-total-count');
const $spectatorHeadline = document.getElementById('spectator-headline');
const $spectatorAvatars = document.getElementById('spectator-avatars');
const $spectatorRoleStatus = document.getElementById('spectator-role-status');
const $confetti      = document.getElementById('confetti-canvas');
const $cardThrowContainer = document.getElementById('card-throw-container');

let currentSessionId = null;
let currentPid       = null;
let unsubscribe      = null;
let unsubReactions   = null;
let selectedRole     = '';
let isSpectator      = false;
let timerInterval    = null;
let timerDuration    = 0;
let previousVotesByPid = new Map();
let previousSessionStatus = null;

let audioCtx = null;
let soundMuted = localStorage.getItem('poker_sound_muted') === 'true';
const SOUND_PROFILE_KEY = 'poker_sound_profile';
const SOUND_VOLUME_KEY = 'poker_sound_volume';
const SOUND_AMBIENT_KEY = 'poker_sound_ambient';
const SOUND_PROFILE_IDS = ['casino', 'arcade', 'minimal'];
const SOUND_PROFILE_LABELS = {
    casino: 'Casino',
    arcade: 'Arcade',
    minimal: 'Minimal',
};

const SOUND_PROFILES = {
    casino: {
        chip: [
            { freq: 520, type: 'square', gain: 0.03, duration: 0.045 },
            { freq: 380, type: 'square', gain: 0.025, duration: 0.06, start: 0.04 },
        ],
        reveal: [
            { freq: 280, type: 'sawtooth', gain: 0.03, duration: 0.08, endFreq: 460 },
            { freq: 420, type: 'triangle', gain: 0.04, duration: 0.11, start: 0.06, endFreq: 740 },
            { freq: 760, type: 'triangle', gain: 0.03, duration: 0.09, start: 0.16, endFreq: 620 },
        ],
        'new-round': [
            { freq: 620, type: 'triangle', gain: 0.03, duration: 0.07, endFreq: 420 },
            { freq: 340, type: 'triangle', gain: 0.025, duration: 0.09, start: 0.07, endFreq: 540 },
        ],
    },
    arcade: {
        chip: [
            { freq: 900, type: 'square', gain: 0.022, duration: 0.04 },
            { freq: 680, type: 'square', gain: 0.018, duration: 0.05, start: 0.03 },
        ],
        reveal: [
            { freq: 440, type: 'square', gain: 0.024, duration: 0.05, endFreq: 520 },
            { freq: 660, type: 'square', gain: 0.024, duration: 0.05, start: 0.05, endFreq: 780 },
            { freq: 880, type: 'square', gain: 0.024, duration: 0.05, start: 0.1, endFreq: 980 },
        ],
        'new-round': [
            { freq: 740, type: 'square', gain: 0.02, duration: 0.045, endFreq: 620 },
            { freq: 560, type: 'square', gain: 0.02, duration: 0.05, start: 0.04, endFreq: 700 },
        ],
    },
    minimal: {
        chip: [
            { freq: 500, type: 'sine', gain: 0.018, duration: 0.03 },
        ],
        reveal: [
            { freq: 420, type: 'sine', gain: 0.02, duration: 0.08, endFreq: 520 },
        ],
        'new-round': [
            { freq: 360, type: 'sine', gain: 0.018, duration: 0.07, endFreq: 430 },
        ],
    },
};

let soundProfile = localStorage.getItem(SOUND_PROFILE_KEY) || 'casino';
if (!SOUND_PROFILE_IDS.includes(soundProfile)) soundProfile = 'casino';

let soundVolume = Number(localStorage.getItem(SOUND_VOLUME_KEY));
if (!Number.isFinite(soundVolume)) soundVolume = 0.7;
soundVolume = Math.max(0, Math.min(1, soundVolume));

let ambientEnabled = localStorage.getItem(SOUND_AMBIENT_KEY) !== 'false';

let masterGainNode = null;
let fxGainNode = null;
let ambientGainNode = null;
let ambientStarted = false;
let ambientOscA = null;
let ambientOscB = null;
let ambientLfo = null;
let ambientLfoGain = null;

function ensureAudioCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
        audioCtx = new AC();
        masterGainNode = audioCtx.createGain();
        fxGainNode = audioCtx.createGain();
        ambientGainNode = audioCtx.createGain();

        masterGainNode.gain.value = 1;
        fxGainNode.gain.value = 1;
        ambientGainNode.gain.value = 0.0001;

        fxGainNode.connect(masterGainNode);
        ambientGainNode.connect(masterGainNode);
        masterGainNode.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    ensureAmbientLoop(audioCtx);
    applyAudioMix();
    return audioCtx;
}

function ensureAmbientLoop(ctx) {
    if (ambientStarted || !ctx || !ambientGainNode) return;
    ambientStarted = true;

    ambientOscA = ctx.createOscillator();
    ambientOscA.type = 'sine';
    ambientOscA.frequency.setValueAtTime(82, ctx.currentTime);

    ambientOscB = ctx.createOscillator();
    ambientOscB.type = 'triangle';
    ambientOscB.frequency.setValueAtTime(123, ctx.currentTime);

    ambientLfo = ctx.createOscillator();
    ambientLfo.type = 'sine';
    ambientLfo.frequency.setValueAtTime(0.07, ctx.currentTime);

    ambientLfoGain = ctx.createGain();
    ambientLfoGain.gain.value = 7;

    ambientLfo.connect(ambientLfoGain);
    ambientLfoGain.connect(ambientOscA.detune);
    ambientLfoGain.connect(ambientOscB.detune);

    ambientOscA.connect(ambientGainNode);
    ambientOscB.connect(ambientGainNode);

    ambientOscA.start();
    ambientOscB.start();
    ambientLfo.start();
}

function applyAudioMix() {
    if (!audioCtx || !masterGainNode || !ambientGainNode) return;
    const now = audioCtx.currentTime;
    const masterTarget = soundMuted ? 0.0001 : 1;
    const ambientTarget = (!soundMuted && ambientEnabled) ? (0.06 * soundVolume) : 0.0001;

    masterGainNode.gain.cancelScheduledValues(now);
    masterGainNode.gain.setTargetAtTime(masterTarget, now, 0.08);

    ambientGainNode.gain.cancelScheduledValues(now);
    ambientGainNode.gain.setTargetAtTime(ambientTarget, now, 0.25);
}

function playTone(ctx, {
    freq,
    type = 'triangle',
    gain = 0.04,
    start = 0,
    duration = 0.08,
    endFreq = null,
}) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = ctx.currentTime + start;
    const t1 = t0 + duration;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq != null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t1);
    }

    const scaledGain = Math.max(0.0001, gain * soundVolume);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(scaledGain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(g);
    g.connect(fxGainNode || ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
}

function playFx(type) {
    if (soundMuted) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const profile = SOUND_PROFILES[soundProfile] || SOUND_PROFILES.casino;
    const tones = profile[type] || [];
    tones.forEach((tone) => playTone(ctx, tone));
}

function updateSoundSettingsUI() {
    const mutedLabel = soundMuted ? 'Muted' : 'On';
    const label = SOUND_PROFILE_LABELS[soundProfile] || 'Casino';

    if ($btnSoundSettings) {
        $btnSoundSettings.textContent = `\uD83C\DFA7 ${mutedLabel}`;
        $btnSoundSettings.classList.toggle('muted', soundMuted);
    }

    if ($btnSoundMute) {
        $btnSoundMute.textContent = soundMuted ? 'Unmute' : 'Mute';
    }

    if ($btnSoundProfileNext) {
        $btnSoundProfileNext.textContent = `Profile: ${label}`;
    }

    if ($inputSoundVolume) {
        $inputSoundVolume.value = String(Math.round(soundVolume * 100));
    }

    if ($soundVolumeValue) {
        $soundVolumeValue.textContent = `${Math.round(soundVolume * 100)}%`;
    }

    if ($chkAmbient) {
        $chkAmbient.checked = ambientEnabled;
    }

    applyAudioMix();
}

// Card suits for decoration
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = { '♠': 'black', '♥': 'red', '♦': 'red', '♣': 'black' };

function getSuitForValue(val, idx) {
    return SUITS[idx % SUITS.length];
}

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

function isPermissionDeniedError(err) {
    const code = String(err?.code || '');
    const message = String(err?.message || err || '');
    return code === 'PERMISSION_DENIED' || code === 'permission-denied' || /permission denied/i.test(message);
}

function handleFirebaseError(err, fallbackMessage = 'Something went wrong') {
    if (isPermissionDeniedError(err)) {
        toast('Permission denied. Please refresh and rejoin the session.');
    } else {
        toast(fallbackMessage);
    }
    console.error(err);
}

async function ensureAuth() {
    const user = await ensureAuthenticated();
    if (!user) {
        toast('Authentication failed. Please refresh and try again.');
        return false;
    }
    return true;
}

function getSessionIdFromHash() {
    const match = location.hash.match(/^#\/session\/(.+)$/);
    return match ? match[1] : null;
}

function setHash(sessionId) {
    location.hash = `#/session/${sessionId}`;
}

// ─── Render hand cards (your cards at bottom) ───
function renderHandCards(selectedValue, disabled) {
    $handCards.innerHTML = '';
    FIBONACCI.forEach((val, idx) => {
        const suit = getSuitForValue(val, idx);
        const isRed = SUIT_COLORS[suit] === 'red';

        const card = document.createElement('div');
        card.className = 'hand-card' + (isRed ? ' suit-red' : '');
        card.dataset.suitTop = `${val}${suit}`;
        card.dataset.suitBottom = `${val}${suit}`;

        if (val === selectedValue) card.classList.add('selected');
        if (disabled || isSpectator) card.classList.add('disabled');

        const valueSpan = document.createElement('span');
        valueSpan.className = 'hand-card-value';
        valueSpan.textContent = val;
        card.appendChild(valueSpan);

        card.addEventListener('click', () => {
            if (!disabled && !isSpectator) {
                onVote(val, card).catch((err) => handleFirebaseError(err, 'Failed to cast vote'));
            }
        });

        $handCards.appendChild(card);
    });
}

// ─── Card throw animation ───
function throwCard(fromEl) {
    if (!fromEl) return;

    const rect = fromEl.getBoundingClientRect();
    const tableEl = document.querySelector('.poker-table');
    const tableRect = tableEl.getBoundingClientRect();

    const flyCard = document.createElement('div');
    flyCard.className = 'flying-card';
    flyCard.style.left = rect.left + 'px';
    flyCard.style.top = rect.top + 'px';
    flyCard.style.width = rect.width + 'px';
    flyCard.style.height = rect.height + 'px';

    $cardThrowContainer.appendChild(flyCard);

    // Animate to center of table
    requestAnimationFrame(() => {
        flyCard.style.left = (tableRect.left + tableRect.width / 2 - 22) + 'px';
        flyCard.style.top = (tableRect.top + tableRect.height / 2 - 31) + 'px';
        flyCard.style.transform = `rotate(${(Math.random() - 0.5) * 30}deg) scale(0.7)`;
        flyCard.style.opacity = '0';
    });

    setTimeout(() => flyCard.remove(), 600);
}

// ─── Render player seats around the poker table ───
const ROLE_ORDER = ['Developer', 'QA', 'DevOps/SRE', 'Designer', 'Business'];

function getSeatingPositions(count) {
    // Distribute players around an ellipse
    const positions = [];
    for (let i = 0; i < count; i++) {
        // Start from top-left, go clockwise
        const angle = (-Math.PI / 2) + (2 * Math.PI * i / count);
        // Elliptical distribution — wider than tall
        const x = 50 + 48 * Math.cos(angle);
        const y = 50 + 46 * Math.sin(angle);
        positions.push({ x, y });
    }
    return positions;
}

function getChipCount(vote) {
    if (vote == null) return 0;
    const normalized = String(vote);
    const fibIndex = FIBONACCI.findIndex((v) => String(v) === normalized);
    if (fibIndex >= 0) return Math.max(1, Math.min(8, fibIndex + 1));

    const numeric = Number(vote);
    if (Number.isNaN(numeric)) return 1;
    return Math.max(1, Math.min(8, Math.ceil(numeric / 3)));
}

function renderSeats(participants, status) {
    $seatsContainer.innerHTML = '';
    if (!participants) return;

    const entries = Object.entries(participants);
    entries.sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));

    const positions = getSeatingPositions(entries.length);

    entries.forEach(([pid, data], idx) => {
        const pos = positions[idx];
        const seat = document.createElement('div');
        seat.className = 'player-seat';
        if (data.spectator) seat.classList.add('seat-spectator');
        seat.style.left = pos.x + '%';
        seat.style.top = pos.y + '%';

        const prevVote = previousVotesByPid.get(pid) ?? null;
        const justVoted = prevVote == null && data.vote != null;

        // Card
        if (!data.spectator) {
            const cardWrap = document.createElement('div');
            cardWrap.className = 'seat-card';

            if (data.vote == null) {
                cardWrap.classList.add('empty');
            } else {
                cardWrap.classList.add('has-vote');
            }
            if (justVoted) {
                cardWrap.classList.add('just-voted');
            }

            if (status === 'revealed' && data.vote != null) {
                cardWrap.classList.add('flipped');
            }

            const inner = document.createElement('div');
            inner.className = 'seat-card-inner';

            const back = document.createElement('div');
            back.className = 'seat-card-back';

            const front = document.createElement('div');
            front.className = 'seat-card-front';
            front.textContent = data.vote != null ? data.vote : '';

            inner.appendChild(back);
            inner.appendChild(front);
            cardWrap.appendChild(inner);
            seat.appendChild(cardWrap);
        }

        // Visual chip stack for placed bets
        if (!data.spectator && data.vote != null) {
            const stack = document.createElement('div');
            stack.className = 'seat-chips' + (justVoted ? ' pulse' : '');
            const chipCount = getChipCount(data.vote);

            for (let i = 0; i < chipCount; i++) {
                const chip = document.createElement('span');
                chip.className = 'mini-chip';
                chip.style.animationDelay = `${i * 35}ms`;
                stack.appendChild(chip);
            }

            seat.appendChild(stack);
        }

        // Name
        const name = document.createElement('div');
        name.className = 'seat-name';
        if (pid === currentPid) name.classList.add('is-you');
        name.textContent = data.name + (pid === currentPid ? ' (you)' : '');
        seat.appendChild(name);

        // Role
        if (data.role && !data.spectator) {
            const role = document.createElement('div');
            role.className = 'seat-role';
            role.textContent = data.role;
            seat.appendChild(role);
        }

        $seatsContainer.appendChild(seat);
    });
}

function renderTableBets(participants, status) {
    if (!$tableBets) return;
    if (status === 'revealed') {
        $tableBets.classList.add('hidden');
        $tableBets.innerHTML = '';
        return;
    }

    const entries = Object.values(participants || {}).filter((p) => !p.spectator && p.vote != null);
    if (!entries.length) {
        $tableBets.classList.add('hidden');
        $tableBets.innerHTML = '';
        return;
    }

    const roleVotes = {};
    entries.forEach((p) => {
        const role = p.role || 'Other';
        roleVotes[role] = (roleVotes[role] || 0) + 1;
    });

    const orderedRoles = [...ROLE_ORDER.filter((r) => roleVotes[r]), ...Object.keys(roleVotes).filter((r) => !ROLE_ORDER.includes(r))];

    $tableBets.innerHTML = '';
    orderedRoles.forEach((role) => {
        const stack = document.createElement('div');
        stack.className = 'table-bet-stack';

        const chips = document.createElement('div');
        chips.className = 'table-bet-chips';
        const stackCount = Math.max(1, Math.min(6, roleVotes[role]));
        for (let i = 0; i < stackCount; i++) {
            const chip = document.createElement('span');
            chip.className = 'table-bet-chip';
            chips.appendChild(chip);
        }

        const label = document.createElement('span');
        label.className = 'table-bet-label';
        label.textContent = `${role} x${roleVotes[role]}`;

        stack.appendChild(chips);
        stack.appendChild(label);
        $tableBets.appendChild(stack);
    });

    $tableBets.classList.remove('hidden');
}

// ─── Compute stats — poker chip style ───
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
        consensus = 'AGREE';
        consensusColor = '#22c55e';
    } else {
        const spread = Math.max(...numericVotes) - Math.min(...numericVotes);
        if (spread <= 3) {
            consensus = 'CLOSE';
            consensusColor = '#f0c040';
        } else {
            consensus = 'SPLIT';
            consensusColor = '#e74c3c';
        }
    }

    return { avg: avgText, consensus, consensusColor, isAgreement: unique.length === 1 };
}

function buildPotChip(label, stats, isTotal) {
    const chip = document.createElement('div');
    chip.className = 'pot-chip' + (isTotal ? ' pot-total' : '');

    const labelEl = document.createElement('div');
    labelEl.className = 'pot-chip-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.className = 'pot-chip-value';
    valueEl.textContent = stats.avg;

    chip.appendChild(labelEl);
    chip.appendChild(valueEl);

    if (stats.consensus && stats.consensus !== '-') {
        const consEl = document.createElement('div');
        consEl.className = 'pot-chip-consensus';
        consEl.textContent = stats.consensus;
        consEl.style.color = stats.consensusColor;
        chip.appendChild(consEl);
    }

    return chip;
}

function computeStats(participants) {
    $potResults.innerHTML = '';
    const all = Object.values(participants || {}).filter(p => !p.spectator);

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
        $potResults.appendChild(buildPotChip('TOTAL', { avg: totalText }, true));
        orderedRoles.forEach(role => {
            $potResults.appendChild(buildPotChip(role.toUpperCase(), roleStats[role], false));
        });
    } else {
        orderedRoles.forEach(role => {
            $potResults.appendChild(buildPotChip(role.toUpperCase(), roleStats[role], true));
        });
    }

    // Confetti on full agreement
    if (hasAnyVotes && allAgreement && all.length > 1) {
        launchConfetti();
    }
}

// ─── Spectator progress ───
const RING_CIRCUMFERENCE = 326.73;

function updateSpectatorProgress(participants) {
    const entries = Object.entries(participants || {});
    const voterEntries = entries.filter(([, p]) => !p.spectator);
    const voted = voterEntries.filter(([, p]) => p.vote != null).length;
    const total = voterEntries.length;
    const allDone = voted === total && total > 0;

    const pct = total > 0 ? voted / total : 0;
    const offset = RING_CIRCUMFERENCE * (1 - pct);
    $spectatorRingProgress.style.strokeDashoffset = offset;
    $spectatorRingProgress.classList.toggle('all-voted', allDone);

    $spectatorVotedCount.textContent = voted;
    $spectatorVotedCount.classList.toggle('all-voted', allDone);
    $spectatorTotalCount.textContent = total;

    if (total === 0) {
        $spectatorHeadline.textContent = 'No players at the table...';
    } else if (allDone) {
        $spectatorHeadline.textContent = 'All bets are in!';
    } else {
        const remaining = total - voted;
        $spectatorHeadline.textContent = remaining === 1
            ? '1 player still deciding...'
            : `${remaining} players still deciding...`;
    }

    $spectatorAvatars.innerHTML = '';
    voterEntries.forEach(([, p]) => {
        const av = document.createElement('div');
        av.className = 'spectator-avatar' + (p.vote != null ? ' voted' : '');
        const parts = (p.name || '?').trim().split(/\s+/);
        const initials = parts.length >= 2
            ? parts[0][0] + parts[parts.length - 1][0]
            : parts[0].slice(0, 2);
        av.textContent = initials;
        av.title = p.name || 'Player';
        $spectatorAvatars.appendChild(av);
    });

    const roleGroups = {};
    voterEntries.forEach(([, p]) => {
        const role = p.role || 'Other';
        if (!roleGroups[role]) roleGroups[role] = { voted: 0, total: 0 };
        roleGroups[role].total++;
        if (p.vote != null) roleGroups[role].voted++;
    });

    const orderedRoles = [...ROLE_ORDER.filter(r => roleGroups[r]), ...Object.keys(roleGroups).filter(r => !ROLE_ORDER.includes(r))];
    $spectatorRoleStatus.innerHTML = '';
    orderedRoles.forEach(role => {
        const g = roleGroups[role];
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
    const colors = ['#d4a017', '#f0c040', '#22c55e', '#e74c3c', '#8b4513', '#3949ab', '#ec4899'];

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

$btnTimer.addEventListener('click', async () => {
    const secs = parseInt($timerSelect.value);
    if (!secs || !currentSessionId) return;
    if (!await ensureAuth()) return;
    const endsAt = Date.now() + secs * 1000;
    try {
        await setTimer(currentSessionId, endsAt);
    } catch (err) {
        handleFirebaseError(err, 'Failed to start timer');
    }
});

$btnTimerStop.addEventListener('click', async () => {
    if (!currentSessionId) return;
    if (!await ensureAuth()) return;
    clearInterval(timerInterval);
    $timerBar.classList.add('hidden');
    try {
        await clearTimer(currentSessionId);
    } catch (err) {
        handleFirebaseError(err, 'Failed to stop timer');
    }
});

// ─── Emoji reactions ───
const seenReactions = new Set();

$reactionsBar.addEventListener('click', async (e) => {
    const btn = e.target.closest('.reaction-btn');
    if (!btn || !currentSessionId || !currentPid) return;
    if (!await ensureAuth()) return;
    try {
        await sendReaction(currentSessionId, currentPid, btn.dataset.emoji);
    } catch (err) {
        handleFirebaseError(err, 'Failed to send reaction');
    }
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
const KEY_MAP = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
    '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

document.addEventListener('keydown', async (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if ($session.classList.contains('hidden')) return;
    if (isSpectator) return;

    const idx = KEY_MAP[e.key];
    if (idx !== undefined && idx < FIBONACCI.length) {
        e.preventDefault();
        const cardEl = $handCards.children[idx];
        try {
            await onVote(FIBONACCI[idx], cardEl);
        } catch (err) {
            handleFirebaseError(err, 'Failed to cast vote');
        }
        return;
    }

    if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (currentSessionId && !$btnReveal.disabled) {
            logEvent(analytics, 'votes_revealed');
            if (!await ensureAuth()) return;
            try {
                await revealVotes(currentSessionId);
            } catch (err) {
                handleFirebaseError(err, 'Failed to reveal votes');
            }
        }
    }
    if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (currentSessionId) {
            if (!await ensureAuth()) return;
            try {
                await newRound(currentSessionId);
            } catch (err) {
                handleFirebaseError(err, 'Failed to start new round');
            }
        }
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

    // Update buttons
    $btnReveal.textContent = status === 'revealed' ? 'CARDS SHOWN' : 'SHOW CARDS';
    $btnReveal.disabled = status === 'revealed';

    if (previousSessionStatus && previousSessionStatus !== status) {
        if (status === 'revealed') playFx('reveal');
        if (previousSessionStatus === 'revealed' && status === 'voting') playFx('new-round');
    }

    // Render table seats
    renderSeats(participants, status);
    renderTableBets(participants, status);

    // Render hand cards
    renderHandCards(myVote, status === 'revealed');

    // Timer
    if (data.timer) {
        startTimerDisplay(data.timer);
    } else {
        clearInterval(timerInterval);
        $timerBar.classList.add('hidden');
    }

    // Spectator view
    if (isSpectator) {
        $handSection.classList.add('hidden');
        if (status !== 'revealed') {
            $spectatorWaiting.classList.remove('hidden');
            updateSpectatorProgress(participants);
        } else {
            $spectatorWaiting.classList.add('hidden');
        }
    } else {
        $handSection.classList.remove('hidden');
        $spectatorWaiting.classList.add('hidden');
    }

    // Pot results
    if (status === 'revealed') {
        $potArea.classList.remove('hidden');
        $reactionsBar.classList.remove('hidden');
        computeStats(participants);
    } else {
        $potArea.classList.add('hidden');
        $reactionsBar.classList.add('hidden');
        seenReactions.clear();
    }

    previousVotesByPid = new Map(
        Object.entries(participants).map(([pid, p]) => [pid, p.vote ?? null])
    );
    previousSessionStatus = status;
}

// ─── Event handlers ───
async function onVote(value, cardEl) {
    if (!currentSessionId || !currentPid || isSpectator) return;
    if (!await ensureAuth()) return;
    logEvent(analytics, 'vote_cast', { value });
    playFx('chip');

    // Throw card animation
    if (cardEl) throwCard(cardEl);

    await castVote(currentSessionId, currentPid, value);
}

async function enterSession(sessionId) {
    currentSessionId = sessionId;
    previousVotesByPid.clear();
    previousSessionStatus = null;
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
    if (!await ensureAuth()) return;
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
        if (!await ensureAuth()) return;
        const id = await createSession();
        logEvent(analytics, 'session_created', { session_id: id });
        await enterSession(id);
    } catch (err) {
        handleFirebaseError(err, 'Failed to create session');
    } finally {
        $btnCreate.disabled = false;
    }
});

$btnJoin.addEventListener('click', async () => {
    try {
        const code = $inputCode.value.trim();
        if (!code) { toast('Enter a session code'); return; }
        if (!await ensureAuth()) return;
        const exists = await sessionExists(code);
        if (!exists) { toast('Session not found'); return; }
        logEvent(analytics, 'session_joined', { session_id: code });
        await enterSession(code);
    } catch (err) {
        handleFirebaseError(err, 'Failed to join session');
    }
});

$inputCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $btnJoin.click();
});

$btnEnter.addEventListener('click', async () => {
    try {
        const name = $inputName.value.trim();
        if (!name) { toast('Enter your name'); return; }
        if (!selectedRole) { toast('Choose your role'); return; }
        saveName(name);
        saveRole(selectedRole);
        isSpectator = $chkSpectator.checked;
        localStorage.setItem('poker_spectator', isSpectator);
        currentPid = getParticipantId();
        if (!await ensureAuth()) return;
        await joinSession(currentSessionId, name, selectedRole, isSpectator);
        showPage($session);
        if (unsubscribe) unsubscribe();
        unsubscribe = subscribeSession(currentSessionId, onSessionUpdate);
        if (unsubReactions) unsubReactions();
        unsubReactions = subscribeReactions(currentSessionId, onReactionsUpdate);
    } catch (err) {
        handleFirebaseError(err, 'Failed to enter session');
    }
});

$inputName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $btnEnter.click();
});

$btnReveal.addEventListener('click', async () => {
    if (currentSessionId) {
        logEvent(analytics, 'votes_revealed');
        if (!await ensureAuth()) return;
        try {
            await revealVotes(currentSessionId);
        } catch (err) {
            handleFirebaseError(err, 'Failed to reveal votes');
        }
    }
});

$btnNewRound.addEventListener('click', async () => {
    if (!currentSessionId) return;
    if (!await ensureAuth()) return;
    try {
        await newRound(currentSessionId);
    } catch (err) {
        handleFirebaseError(err, 'Failed to start new round');
    }
});

$btnCopyLink.addEventListener('click', () => {
    const url = `${location.origin}${location.pathname}#/session/${currentSessionId}`;
    navigator.clipboard.writeText(url).then(() => toast('Link copied!'));
});

if ($btnSoundSettings && $soundPopover) {
    $btnSoundSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        const opening = $soundPopover.classList.contains('hidden');
        $soundPopover.classList.toggle('hidden');
        $btnSoundSettings.setAttribute('aria-expanded', opening ? 'true' : 'false');
        if (opening) ensureAudioCtx();
    });

    document.addEventListener('click', (e) => {
        if ($soundPopover.classList.contains('hidden')) return;
        if ($soundPopover.contains(e.target) || $btnSoundSettings.contains(e.target)) return;
        $soundPopover.classList.add('hidden');
        $btnSoundSettings.setAttribute('aria-expanded', 'false');
    });
}

if ($btnSoundMute) {
    $btnSoundMute.addEventListener('click', () => {
        ensureAudioCtx();
        soundMuted = !soundMuted;
        localStorage.setItem('poker_sound_muted', String(soundMuted));
        updateSoundSettingsUI();
        if (!soundMuted) playFx('chip');
    });
}

if ($btnSoundProfileNext) {
    $btnSoundProfileNext.addEventListener('click', () => {
        const idx = SOUND_PROFILE_IDS.indexOf(soundProfile);
        const nextIdx = idx === -1 ? 0 : (idx + 1) % SOUND_PROFILE_IDS.length;
        soundProfile = SOUND_PROFILE_IDS[nextIdx];
        localStorage.setItem(SOUND_PROFILE_KEY, soundProfile);
        updateSoundSettingsUI();
        if (!soundMuted) playFx('chip');
    });
}

if ($inputSoundVolume) {
    $inputSoundVolume.addEventListener('input', () => {
        ensureAudioCtx();
        const pct = Number($inputSoundVolume.value);
        if (!Number.isFinite(pct)) return;
        soundVolume = Math.max(0, Math.min(1, pct / 100));
        localStorage.setItem(SOUND_VOLUME_KEY, String(soundVolume));
        updateSoundSettingsUI();
    });
}

if ($chkAmbient) {
    $chkAmbient.addEventListener('change', () => {
        ensureAudioCtx();
        ambientEnabled = $chkAmbient.checked;
        localStorage.setItem(SOUND_AMBIENT_KEY, String(ambientEnabled));
        updateSoundSettingsUI();
    });
}

// ─── Router / Init ───
async function init() {
    updateSoundSettingsUI();
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
        try {
            const exists = await sessionExists(hashId);
            if (exists) {
                await enterSession(hashId);
                return;
            }
            toast('Session not found');
            location.hash = '';
        } catch (err) {
            handleFirebaseError(err, 'Failed to load session');
        }
    }

    showPage($landing);
}

window.addEventListener('hashchange', async () => {
    const hashId = getSessionIdFromHash();
    if (hashId && hashId !== currentSessionId) {
        try {
            const exists = await sessionExists(hashId);
            if (exists) {
                await enterSession(hashId);
            } else {
                toast('Session not found');
                location.hash = '';
                showPage($landing);
            }
        } catch (err) {
            handleFirebaseError(err, 'Failed to open session');
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
