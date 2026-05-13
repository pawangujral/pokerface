'use client';

import type { Participant } from '@/types';

interface Props {
  participants: Record<string, Participant>;
}

function computeStats(votes: string[]) {
  const numeric = votes
    .filter((v) => v !== '?' && v !== '☕')
    .map(Number)
    .filter((n) => !isNaN(n));

  if (numeric.length === 0) return null;

  const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);

  const freq: Record<string, number> = {};
  for (const v of votes) freq[v] = (freq[v] || 0) + 1;
  const mode = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  const agreement = max - min <= 1 ? 'High' : max - min <= 3 ? 'Medium' : 'Low';

  return { avg: avg.toFixed(1), min, max, mode, agreement };
}

export default function ResultsPanel({ participants }: Props) {
  const voters = Object.values(participants).filter((p) => !p.spectator && p.vote !== null);
  const votes = voters.map((p) => p.vote!);
  const stats = computeStats(votes);

  if (voters.length === 0) return null;

  const byVote: Record<string, string[]> = {};
  for (const [, p] of Object.entries(participants)) {
    if (p.spectator || p.vote === null) continue;
    if (!byVote[p.vote!]) byVote[p.vote!] = [];
    byVote[p.vote!].push(p.name);
  }

  return (
    <div className="results-panel">
      {stats && (
        <div className="result-card">
          <div className="result-card-title">Summary</div>
          <div className="result-card-stats">
            <div className="result-stat">
              <span className="stat-label">Avg</span>
              <span className="stat-value">{stats.avg}</span>
            </div>
            <div className="result-stat">
              <span className="stat-label">Mode</span>
              <span className="stat-value">{stats.mode}</span>
            </div>
            <div className="result-stat">
              <span className="stat-label">Range</span>
              <span className="stat-value">{stats.min}–{stats.max}</span>
            </div>
            <div className="result-stat">
              <span className="stat-label">Agreement</span>
              <span className="stat-value">{stats.agreement}</span>
            </div>
          </div>
        </div>
      )}

      {Object.entries(byVote)
        .sort((a, b) => Number(b[0]) - Number(a[0]) || a[0].localeCompare(b[0]))
        .map(([vote, names]) => (
          <div key={vote} className="result-card">
            <div className="result-card-title">Voted {vote}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {names.join(', ')}
            </div>
          </div>
        ))}
    </div>
  );
}
