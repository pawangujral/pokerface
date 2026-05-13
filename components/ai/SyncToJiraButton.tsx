'use client';

import { useState } from 'react';
import type { AIPanelState } from '@/types';

interface Props {
  aiPanel: AIPanelState | undefined;
  agreedEstimate: string | null;
  onSync: (storyPoints: number, reasoning: string) => Promise<void>;
}

export default function SyncToJiraButton({ aiPanel, agreedEstimate, onSync }: Props) {
  const [reasoning, setReasoning] = useState('');

  const numericEstimate = agreedEstimate ? Number(agreedEstimate) : NaN;
  const canSync = !isNaN(numericEstimate) && aiPanel?.ticketId && aiPanel.syncStatus !== 'syncing' && aiPanel.syncStatus !== 'done';

  async function handleSyncWithSummary() {
    if (!canSync) return;
    await onSync(numericEstimate, reasoning);
  }

  if (!aiPanel?.ticketId) return null;

  return (
    <div style={{ marginTop: '14px' }}>
      <div className="reasoning-row">
        <label htmlFor="reasoning">Team reasoning (optional)</label>
        <textarea
          id="reasoning"
          placeholder="e.g. Complex DB migration required, no existing tests…"
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          disabled={aiPanel.syncStatus === 'done'}
        />
      </div>

      <button
        className="btn btn-sync-jira"
        onClick={handleSyncWithSummary}
        disabled={!canSync}
        style={{ marginTop: '10px', width: '100%' }}
      >
        {aiPanel.syncStatus === 'syncing' ? '⏳ Syncing…' : aiPanel.syncStatus === 'done' ? '✓ Synced to Jira' : '🔄 Sync to Jira'}
      </button>

      {aiPanel.syncStatus === 'done' && (
        <p className="sync-status-text success">
          ✓ Story points and comment posted to {aiPanel.ticketId}.
        </p>
      )}
      {aiPanel.syncStatus === 'error' && (
        <p className="sync-status-text error">
          ✗ Sync failed. {aiPanel.errorMessage}
        </p>
      )}
    </div>
  );
}
