'use client';

import { useState, useEffect } from 'react';
import { joinSession, getSavedName, saveName, getSavedRole, saveRole } from '@/lib/firebase/session';
import type { Role } from '@/types';

const ROLES: Role[] = ['Developer', 'QA', 'DevOps/SRE', 'Designer', 'Business'];

interface Props {
  sessionCode: string;
  isCreator: boolean;
  onDone: () => void;
}

export default function NameEntry({ sessionCode, isCreator, onDone }: Props) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [spectator, setSpectator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedName = getSavedName();
    const savedRole = getSavedRole() as Role | '';
    if (savedName) setName(savedName);
    if (savedRole && ROLES.includes(savedRole as Role)) setRole(savedRole as Role);
  }, []);

  const canEnter = name.trim().length > 0 && (role !== null || spectator);

  async function handleEnter() {
    if (!canEnter) return;
    setError('');
    setLoading(true);
    try {
      saveName(name.trim());
      if (role) saveRole(role);
      await joinSession(sessionCode, name.trim(), spectator ? null : role, spectator);
      onDone();
    } catch {
      setError('Failed to join. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="container">
        <h1>♠ Planning Poker</h1>
        <div className="card">
          <h2>What&apos;s your name?</h2>

          <div className="name-group">
            <input
              type="text"
              placeholder="Enter your name"
              maxLength={30}
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canEnter && handleEnter()}
              autoFocus
            />
          </div>

          {!spectator && (
            <>
              <h2 className="role-heading">What&apos;s your role?</h2>
              <div className="role-selector">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`role-chip${role === r ? ' active' : ''}`}
                    onClick={() => setRole(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}

          <label className="spectator-toggle">
            <input
              type="checkbox"
              checked={spectator}
              onChange={(e) => {
                setSpectator(e.target.checked);
                if (e.target.checked) setRole(null);
              }}
            />
            Join as spectator
          </label>

          <button
            className="btn btn-primary btn-large"
            onClick={handleEnter}
            disabled={!canEnter || loading}
          >
            {loading ? 'Joining…' : isCreator ? 'Start Session' : 'Join Session'}
          </button>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '12px', textAlign: 'center' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
