'use client';

import { useEffect, useState } from 'react';
import MCPSettingsModal from './MCPSettingsModal';
import PokerReadySummaryView from './PokerReadySummary';
import SyncToJiraButton from './SyncToJiraButton';
import { loadMCPCredentials } from '@/hooks/useAIPanel';
import type { AIPanelState, PokerReadySummary } from '@/types';

interface Props {
  sessionId: string;
  isModerator: boolean;
  aiPanel: AIPanelState | undefined;
  summary: PokerReadySummary | null;
  agreedEstimate: string | null;
  onFetch: (ticketId: string) => Promise<void>;
  onSync: (storyPoints: number, reasoning: string) => Promise<void>;
  fetchError: string | null;
}

export default function AIPanel({
  sessionId,
  isModerator,
  aiPanel,
  summary,
  agreedEstimate,
  onFetch,
  onSync,
  fetchError,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [ticketId, setTicketId] = useState(aiPanel?.ticketId ?? '');
  const [hasCreds, setHasCreds] = useState(false);

  useEffect(() => {
    setHasCreds(!!loadMCPCredentials());
  }, [showSettings]);

  useEffect(() => {
    if (aiPanel?.ticketId) setTicketId(aiPanel.ticketId);
  }, [aiPanel?.ticketId]);

  // Parse summary from Firebase when we don't have it locally yet
  const displaySummary: PokerReadySummary | null = summary ?? (() => {
    if (aiPanel?.summary) {
      try { return JSON.parse(aiPanel.summary); } catch { return null; }
    }
    return null;
  })();

  const statusLabel = aiPanel?.status ?? 'idle';

  return (
    <>
      <div className="ai-panel">
        <div className="ai-panel-header" onClick={() => setCollapsed((c) => !c)}>
          <h3>🤖 AI Engineering Partner</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {collapsed ? '▲' : '▼'}
          </span>
        </div>

        <div className={`ai-panel-body${collapsed ? ' collapsed' : ''}`}>
          {/* Status badge */}
          <span className={`ai-status-badge ${statusLabel}`} style={{ marginBottom: '12px', display: 'inline-flex' }}>
            {statusLabel === 'loading' && '⏳ '}
            {statusLabel === 'ready' && '✓ '}
            {statusLabel === 'error' && '✗ '}
            {statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}
          </span>

          {isModerator ? (
            <>
              {/* Settings link */}
              <div style={{ marginBottom: '12px' }}>
                <button className="ai-settings-link" onClick={() => setShowSettings(true)}>
                  {hasCreds ? '✓ MCP configured · edit settings' : '⚙ Configure MCP connection'}
                </button>
              </div>

              {/* Fetch row */}
              <div className="ai-fetch-row">
                <input
                  type="text"
                  placeholder="Jira ticket (e.g. PROJ-123)"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && ticketId.trim() && onFetch(ticketId.trim())}
                />
                <button
                  className="btn btn-primary btn-small"
                  onClick={() => ticketId.trim() && onFetch(ticketId.trim())}
                  disabled={!ticketId.trim() || aiPanel?.status === 'loading'}
                >
                  Fetch
                </button>
              </div>

              {fetchError && (
                <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginBottom: '10px' }}>
                  {fetchError}
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {aiPanel?.status === 'idle'
                ? 'Waiting for moderator to fetch a Jira ticket…'
                : aiPanel?.status === 'loading'
                ? '⏳ Moderator is fetching ticket context…'
                : null}
            </p>
          )}

          {/* Summary (visible to all) */}
          {displaySummary && aiPanel?.status === 'ready' && (
            <PokerReadySummaryView summary={displaySummary} />
          )}

          {/* Sync to Jira (moderator only, after reveal) */}
          {isModerator && agreedEstimate && aiPanel && (
            <SyncToJiraButton
              aiPanel={aiPanel}
              agreedEstimate={agreedEstimate}
              onSync={onSync}
            />
          )}
        </div>
      </div>

      {showSettings && <MCPSettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
