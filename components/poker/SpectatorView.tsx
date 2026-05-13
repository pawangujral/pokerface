'use client';

import type { Participant } from '@/types';

interface Props {
  participants: Record<string, Participant>;
}

export default function SpectatorView({ participants }: Props) {
  const voters = Object.entries(participants).filter(([, p]) => !p.spectator);
  const voted = voters.filter(([, p]) => p.vote !== null);
  const total = voters.length;
  const count = voted.length;
  const allVoted = total > 0 && count === total;

  const circumference = 2 * Math.PI * 50;
  const offset = total > 0 ? circumference * (1 - count / total) : circumference;

  const roleVoted: Record<string, { total: number; voted: number }> = {};
  for (const [, p] of voters) {
    const r = p.role ?? 'Unknown';
    if (!roleVoted[r]) roleVoted[r] = { total: 0, voted: 0 };
    roleVoted[r].total++;
    if (p.vote !== null) roleVoted[r].voted++;
  }

  return (
    <div className="spectator-waiting">
      <div className="spectator-ring-wrap">
        <svg className="spectator-ring" viewBox="0 0 120 120">
          <circle className="spectator-ring-track" cx="60" cy="60" r="50" />
          <circle
            className={`spectator-ring-value${allVoted ? ' all-voted' : ''}`}
            cx="60" cy="60" r="50"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="spectator-ring-label">
          <span className={`spectator-ring-big${allVoted ? ' all-voted' : ''}`}>{count}</span>
          <span className="spectator-ring-sep">/</span>
          <span className="spectator-ring-small">{total}</span>
        </div>
      </div>

      <p className="spectator-headline">
        {allVoted ? '🎉 All voted — waiting for reveal' : 'Waiting for votes…'}
      </p>

      <div className="spectator-avatars">
        {voters.map(([pid, p]) => (
          <div
            key={pid}
            className={`spectator-avatar${p.vote !== null ? ' voted' : ''}`}
            title={p.name}
          >
            {p.name.slice(0, 2).toUpperCase()}
          </div>
        ))}
      </div>

      <div className="spectator-role-status">
        {Object.entries(roleVoted).map(([role, { total: t, voted: v }]) => (
          <div key={role} className={`spectator-role-chip${v === t ? ' complete' : ''}`}>
            <span className="chip-dot" />
            <span className="chip-count">{v}/{t}</span>
            {role}
          </div>
        ))}
      </div>
    </div>
  );
}
