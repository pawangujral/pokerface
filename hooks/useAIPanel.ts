'use client';

import { useState, useCallback } from 'react';
import { updateAIPanel } from '@/lib/firebase/session';
import type { JiraFetchResponse, JiraSyncRequest, MCPCredentials, PokerReadySummary } from '@/types';

const STORAGE_KEY = 'pokerface_mcp_credentials';

// ─── sessionStorage helpers (never touches server or Firebase) ────────────────

export function loadMCPCredentials(): MCPCredentials | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveMCPCredentials(creds: MCPCredentials): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

export function clearMCPCredentials(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAIPanel(sessionId: string | null) {
  const [summary, setSummary] = useState<PokerReadySummary | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchTicket = useCallback(async (ticketId: string) => {
    if (!sessionId) return;
    const creds = loadMCPCredentials();
    if (!creds) {
      setFetchError('MCP credentials not configured. Open AI Settings first.');
      return;
    }

    setFetchError(null);
    await updateAIPanel(sessionId, { status: 'loading', ticketId, summary: '', errorMessage: '' });

    try {
      const res = await fetch('/api/mcp/jira-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...creds, ticketId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? res.statusText);
      }

      const data: JiraFetchResponse = await res.json();
      setSummary(data.summary);

      await updateAIPanel(sessionId, {
        status: 'ready',
        ticketId,
        summary: JSON.stringify(data.summary),
        fetchedAt: Date.now(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch ticket';
      setFetchError(msg);
      await updateAIPanel(sessionId, { status: 'error', errorMessage: msg });
    }
  }, [sessionId]);

  const syncToJira = useCallback(async (
    ticketId: string,
    storyPoints: number,
    reasoning: string,
    teamSummary: string,
  ) => {
    if (!sessionId) return;
    const creds = loadMCPCredentials();
    if (!creds) {
      setSyncError('MCP credentials not configured.');
      return;
    }

    setSyncError(null);
    await updateAIPanel(sessionId, { syncStatus: 'syncing' });

    try {
      const body: JiraSyncRequest = { ...creds, ticketId, storyPoints, reasoning, teamSummary };
      const res = await fetch('/api/mcp/jira-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? res.statusText);
      }

      await updateAIPanel(sessionId, { syncStatus: 'done', syncedAt: Date.now() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setSyncError(msg);
      await updateAIPanel(sessionId, { syncStatus: 'error', errorMessage: msg });
    }
  }, [sessionId]);

  return { summary, setSummary, fetchError, syncError, fetchTicket, syncToJira };
}
