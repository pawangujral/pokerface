'use client';

import { FIBONACCI } from '@/lib/firebase/session';

interface Props {
  selectedVote: string | null;
  revealed: boolean;
  onVote: (value: string) => void;
}

export default function EstimationCards({ selectedVote, revealed, onVote }: Props) {
  return (
    <div className="estimation-section">
      <h3>Your estimate <span className="kbd-hint">(press 1–9, ?, ☕)</span></h3>
      <div className="estimation-cards">
        {FIBONACCI.map((val) => (
          <button
            key={val}
            className={[
              'est-card',
              selectedVote === val ? 'selected' : '',
              revealed ? 'disabled' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => !revealed && onVote(val)}
            aria-pressed={selectedVote === val}
          >
            {val}
          </button>
        ))}
      </div>
    </div>
  );
}
