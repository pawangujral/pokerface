'use client';

import { useState, useRef } from 'react';
import { saveMCPCredentials, clearMCPCredentials, loadMCPCredentials } from '@/hooks/useAIPanel';

interface Props {
  onClose: () => void;
}

export default function MCPSettingsModal({ onClose }: Props) {
  const existing = loadMCPCredentials();
  const [mcpUrl, setMcpUrl] = useState(existing?.mcpUrl ?? '');
  const [token, setToken] = useState(existing?.token ?? '');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    saveMCPCredentials({ mcpUrl: mcpUrl.trim(), token: token.trim() });
    setSaved(true);
    setTimeout(onClose, 800);
  }

  function handleClear() {
    clearMCPCredentials();
    setMcpUrl('');
    setToken('');
  }

  const canSave = mcpUrl.trim().length > 0 && token.trim().length > 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="AI Settings">
        <h2>🔧 AI / MCP Settings</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
          Credentials are stored in your browser&apos;s <strong>sessionStorage</strong> only — 
          never sent to our servers or stored in the database.
        </p>

        <div className="modal-field">
          <label htmlFor="mcp-url">MCP Server URL</label>
          <input
            id="mcp-url"
            type="text"
            placeholder="https://your-company.jira-mcp.example.com"
            value={mcpUrl}
            onChange={(e) => setMcpUrl(e.target.value)}
          />
          <p className="field-hint">Your company&apos;s Jira MCP server endpoint.</p>
        </div>

        <div className="modal-field">
          <label htmlFor="mcp-token">Bearer Token / PAT</label>
          <input
            id="mcp-token"
            type="password"
            placeholder="••••••••••••••••"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
          <p className="field-hint">Your Personal Access Token — stays in your browser.</p>
        </div>

        <div className="modal-actions">
          {existing && (
            <button className="btn btn-secondary btn-small" onClick={handleClear}>
              Clear
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
