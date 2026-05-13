import {
  db,
  authReady,
  ref,
  set,
  get,
  onValue,
  update,
  remove,
  serverTimestamp,
  onDisconnect,
} from './client';
import type { Session, Participant, Role, AIPanelState } from '@/types';

export const FIBONACCI = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];
const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

// ─── Participant identity (localStorage) ─────────────────────────────────────

export function getParticipantId(): string {
  let id = localStorage.getItem('poker_participant_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('poker_participant_id', id);
  }
  return id;
}

export function getSavedName(): string {
  return localStorage.getItem('poker_name') || '';
}

export function saveName(name: string): void {
  localStorage.setItem('poker_name', name);
}

export function getSavedRole(): string {
  return localStorage.getItem('poker_role') || '';
}

export function saveRole(role: string): void {
  localStorage.setItem('poker_role', role);
}

// ─── Session ID generation ────────────────────────────────────────────────────

function generateSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

// ─── Session operations ───────────────────────────────────────────────────────

export async function createSession(creatorPid: string): Promise<string> {
  await authReady;
  const sessionId = generateSessionId();
  await set(ref(db, `sessions/${sessionId}`), {
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    status: 'voting',
    createdBy: creatorPid,
  });
  return sessionId;
}

export async function sessionExists(sessionId: string): Promise<boolean> {
  const snap = await get(ref(db, `sessions/${sessionId}`));
  if (!snap.exists()) return false;
  const data = snap.val() as Session;
  const expiry = data.expiresAt || 0;
  if (expiry && Date.now() > expiry) {
    await remove(ref(db, `sessions/${sessionId}`));
    return false;
  }
  return true;
}

export async function joinSession(
  sessionId: string,
  name: string,
  role: Role | null,
  spectator = false,
): Promise<string> {
  await authReady;
  const pid = getParticipantId();
  const pRef = ref(db, `sessions/${sessionId}/participants/${pid}`);
  const participant = {
    name,
    role,
    vote: null,
    spectator,
    joinedAt: serverTimestamp(),
  };
  await set(pRef, participant);
  onDisconnect(pRef).remove();
  return pid;
}

export function subscribeSession(
  sessionId: string,
  callback: (data: Session | null) => void,
): () => void {
  return onValue(ref(db, `sessions/${sessionId}`), (snap) => {
    callback(snap.val() as Session | null);
  });
}

export async function castVote(
  sessionId: string,
  participantId: string,
  value: string,
): Promise<void> {
  await set(ref(db, `sessions/${sessionId}/participants/${participantId}/vote`), value);
}

export async function sendReaction(
  sessionId: string,
  participantId: string,
  emoji: string,
): Promise<void> {
  await set(ref(db, `sessions/${sessionId}/reactions/${participantId}`), {
    emoji,
    ts: serverTimestamp(),
  });
}

export function subscribeReactions(
  sessionId: string,
  callback: (data: Record<string, { emoji: string; ts: number }> | null) => void,
): () => void {
  return onValue(ref(db, `sessions/${sessionId}/reactions`), (snap) => {
    callback(snap.val());
  });
}

export async function setTimer(sessionId: string, endsAt: number): Promise<void> {
  await set(ref(db, `sessions/${sessionId}/timer`), endsAt);
}

export async function clearTimer(sessionId: string): Promise<void> {
  await set(ref(db, `sessions/${sessionId}/timer`), null);
}

export async function revealVotes(sessionId: string): Promise<void> {
  await set(ref(db, `sessions/${sessionId}/status`), 'revealed');
}

export async function newRound(sessionId: string): Promise<void> {
  const snap = await get(ref(db, `sessions/${sessionId}/participants`));
  if (!snap.exists()) return;

  const updates: Record<string, null | string> = {
    [`sessions/${sessionId}/status`]: 'voting',
    [`sessions/${sessionId}/timer`]: null,
    [`sessions/${sessionId}/reactions`]: null,
  };
  snap.forEach((child) => {
    updates[`sessions/${sessionId}/participants/${child.key}/vote`] = null;
  });
  await update(ref(db), updates);
}

// ─── AI Panel Firebase writes (moderator only, non-sensitive) ─────────────────

export async function updateAIPanel(
  sessionId: string,
  patch: Partial<AIPanelState>,
): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    updates[`sessions/${sessionId}/aiPanel/${k}`] = v;
  }
  await update(ref(db), updates);
}

export async function cleanupExpiredSessions(): Promise<void> {
  const snap = await get(ref(db, 'sessions'));
  if (!snap.exists()) return;

  const now = Date.now();
  const updates: Record<string, null> = {};
  snap.forEach((child) => {
    const data = child.val() as Session;
    const expiry = data.expiresAt || 0;
    if (expiry && now > expiry) updates[`sessions/${child.key}`] = null;
  });

  if (Object.keys(updates).length > 0) await update(ref(db), updates);
}
