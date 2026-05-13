'use client';

import type { PokerReadySummary } from '@/types';

interface Props {
  summary: PokerReadySummary;
}

export default function PokerReadySummaryView({ summary }: Props) {
  return (
    <div>
      <p className="ai-summary-title">{summary.ticketKey}: {summary.title}</p>

      <div className="ai-summary-section">
        <h4>🧩 Complexity signals</h4>
        <ul className="ai-bullet-list">
          {summary.complexity.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="ai-summary-section">
        <h4>⚠ Risks</h4>
        <ul className="ai-bullet-list">
          {summary.risks.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>

      {summary.requirements.length > 0 && (
        <div className="ai-summary-section">
          <h4>✅ Acceptance criteria</h4>
          <ul className="ai-bullet-list">
            {summary.requirements.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
