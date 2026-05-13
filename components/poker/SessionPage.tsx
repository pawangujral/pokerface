'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useModerator } from '@/hooks/useModerator';
import { useAIPanel } from '@/hooks/useAIPanel';
import { getParticipantId, sessionExists } from '@/lib/firebase/session';
import ParticipantCard from './ParticipantCard';
import EstimationCards from './EstimationCards';
import ResultsPanel from './ResultsPanel';
import Timer from './Timer';
import ReactionsBar from './ReactionsBar';
import SpectatorView from './SpectatorView';
import AIPanel from '@/components/ai/AIPanel';
import { authReady } from '@/lib/firebase/client';
import type { PokerReadySummary } from '@/types';

const TIMER_OPTIONS: Record<string, number> = {
  '1 min': 60_000,
  '2 min': 120_000,
  '3 min': 180_000,
  '5 min': 300_000,
};

interface Props { code: string; }

export default function SessionPage({ code }: Props) {
  const router = useRouter();
  const [pid, setPid] = useState<string | null>(null);
  const [timerDuration, setTimerDuration] = useState('2 min');
  const [toast, setToast] = useState<string | null>(null);
  const [agreed, setAgreed] = useState<string | null>(null);

  const { session, reactions, loading, castVote, revealVotes, startNewRound, startTimer, stopTimer, sendReaction } =
    useSession(code, pid);
  const isModerator = useModerator(session, pid);
  const { summary, setSummary, fetchError, syncError, fetchTicket, syncToJira } = useAIPanel(code);

  // Get or create participant ID
  useEffect(() => {
    authReady.then(() => setPid(getParticipantId()));
  }, []);

  // Verify session exists on mount
  useEffect(() => {
    authReady.then(async () => {
      const exists = await sessionExists(code);
      if (!exists) router.replace('/');
    });
  }, [code, router]);

  // Keyboard shortcuts for card selection
  useEffect(() => {
    if (!session || session.status === 'revealed') return;
    const map: Record<string, string> = {
      '0': '0', '1': '1', '2': '2', '3': '3', '5': '5',
      '8': '8', '9': '13', '?': '?',
    };
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const val = map[e.key];
      if (val) castVote(val);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, castVote]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  async function handleCopyLink() {
    const url = `${window.location.origin}/?session=${code}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    showToast('Link copied!');
  }

  async function handleReveal() {
    await revealVotes();
  }

  async function handleNewRound() {
    setAgreed(null);
    setSummary(null);
    await startNewRound();
  }

  async function handleTimer() {
    const ms = TIMER_OPTIONS[timerDuration];
    if (ms) await startTimer(ms);
  }

  function computeAgreed(): string | null {
    if (!session || session.status !== 'revealed') return null;
    const voters = Object.values(session.participants ?? {}).filter((p) => !p.spectator && p.vote !== null);
    if (voters.length === 0) return null;
    const votes = voters.map((p) => p.vote!);
    const numeric = votes.filter((v) => v !== '?' && v !== '☕').map(Number);
    if (numeric.length === 0) return null;
    const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
    return String(Math.round(avg));
  }

  async function handleSync(storyPoints: number, reasoning: string) {
    if (!session?.aiPanel?.ticketId) return;
    const summaryText = summary
      ? `Complexity: ${summary.complexity.join(' | ')}\nRisks: ${summary.risks.join(' | ')}`
      : '';
    await syncToJira(session.aiPanel.ticketId, storyPoints, reasoning, summaryText);
  }

  if (loading) {
    return (
      <div className="page">
        <div className="container" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading session…</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const participants = session.participants ?? {};
  const revealed = session.status === 'revealed';
  const myVote = pid ? (participants[pid]?.vote ?? null) : null;
  const amSpectator = pid ? (participants[pid]?.spectator ?? false) : false;
  const voters = Object.values(participants).filter((p) => !p.spectator);
  const allVoted = voters.length > 0 && voters.every((p) => p.vote !== null);
  const agreedEstimate = computeAgreed();

  return (
    <div className="page" id="session-page" style={{ alignItems: 'flex-start', paddingTop: '20px' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        {/* Header */}
        <div className="session-header">
          <h1>♠ Planning Poker</h1>
          <div className="session-info">
            <span className="session-code">{code}</span>
            <button className="btn btn-small" onClick={handleCopyLink}>Copy Link</button>
          </div>
        </div>

        <div className="session-with-ai">
          {/* Left: poker table */}
          <div>
            {/* Left sidebar: participants */}
            <div className="session-layout" style={{ marginBottom: '20px' }}>
              <div className="participants-container">
                <div className="participants-panel">
                  <h3>Participants</h3>
                  <ul className="participants-list">
                    {Object.entries(participants).map(([id, p]) => (
                      <ParticipantCard key={id} pid={id} participant={p} currentPid={pid ?? ''} revealed={revealed} />
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right: voting area */}
              <div>
                {/* Timer */}
                <Timer
                  endsAt={session.timer ?? null}
                  onExpire={() => isModerator && revealVotes()}
                  onStop={() => stopTimer()}
                />

                {/* Actions */}
                <div className="actions">
                  {isModerator && !revealed && (
                    <button
                      className="btn btn-primary"
                      onClick={handleReveal}
                      disabled={!allVoted}
                    >
                      Reveal Votes
                    </button>
                  )}
                  {isModerator && revealed && (
                    <button className="btn btn-secondary" onClick={handleNewRound}>
                      New Round
                    </button>
                  )}

                  {isModerator && !revealed && (
                    <div className="timer-group">
                      <select value={timerDuration} onChange={(e) => setTimerDuration(e.target.value)}>
                        {Object.keys(TIMER_OPTIONS).map((opt) => (
                          <option key={opt}>{opt}</option>
                        ))}
                      </select>
                      <button className="btn btn-small" onClick={handleTimer}>⏱ Start</button>
                    </div>
                  )}
                </div>

                {/* Results */}
                {revealed && <ResultsPanel participants={participants} />}

                {/* Estimation cards or spectator view */}
                {amSpectator ? (
                  <SpectatorView participants={participants} />
                ) : (
                  !revealed && (
                    <EstimationCards
                      selectedVote={myVote}
                      revealed={revealed}
                      onVote={castVote}
                    />
                  )
                )}
              </div>
            </div>
          </div>

          {/* Right: AI panel */}
          <div>
            <AIPanel
              sessionId={code}
              isModerator={isModerator}
              aiPanel={session.aiPanel}
              summary={summary}
              agreedEstimate={revealed ? agreedEstimate : null}
              onFetch={fetchTicket}
              onSync={handleSync}
              fetchError={fetchError}
            />
          </div>
        </div>

        <ReactionsBar reactions={reactions} onSend={sendReaction} />
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
