'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createSession,
  sessionExists,
  getParticipantId,
  cleanupExpiredSessions,
} from '@/lib/firebase/session';
import { authReady } from '@/lib/firebase/client';
import NameEntry from './NameEntry';

export default function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionCode, setSessionCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);

  // Support ?session=CODE deep links
  useEffect(() => {
    const code = searchParams.get('session');
    if (code) setSessionCode(code);
  }, [searchParams]);

  // Clean up expired sessions on page load (best-effort)
  useEffect(() => {
    authReady.then(() => cleanupExpiredSessions().catch(() => {}));
  }, []);

  async function handleCreate() {
    setError('');
    setCreating(true);
    try {
      await authReady;
      const pid = getParticipantId();
      const code = await createSession(pid);
      setIsCreator(true);
      setPendingCode(code);
    } catch {
      setError('Failed to create session. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    const code = sessionCode.trim();
    if (!code) return;
    setError('');
    setJoining(true);
    try {
      await authReady;
      const exists = await sessionExists(code);
      if (!exists) {
        setError('Session not found or has expired.');
        return;
      }
      setIsCreator(false);
      setPendingCode(code);
    } catch {
      setError('Failed to join session. Please try again.');
    } finally {
      setJoining(false);
    }
  }

  function handleNameConfirmed() {
    if (pendingCode) router.push(`/session/${pendingCode}`);
  }

  if (pendingCode) {
    return (
      <NameEntry
        sessionCode={pendingCode}
        isCreator={isCreator}
        onDone={handleNameConfirmed}
      />
    );
  }

  return (
    <div className="page">
      <div className="container">
        <h1>Show us your poker face!</h1>
        <p className="subtitle">Estimate together, ship faster</p>

        <div className="card">
          <button
            className="btn btn-primary btn-large"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create Session'}
          </button>

          <div className="divider"><span>or</span></div>

          <div className="join-group">
            <input
              type="text"
              placeholder="Enter session code"
              maxLength={20}
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button
              className="btn btn-secondary"
              onClick={handleJoin}
              disabled={joining || !sessionCode.trim()}
            >
              {joining ? '…' : 'Join'}
            </button>
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '12px', textAlign: 'center' }}>
              {error}
            </p>
          )}
        </div>
      </div>

      <footer className="site-footer">
        Free &amp; open source · <a href="/help.html" target="_blank" rel="noopener">Help</a>
      </footer>
    </div>
  );
}
