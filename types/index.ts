// ─── Session types ───────────────────────────────────────────────────────────

export type Role = 'Developer' | 'QA' | 'DevOps/SRE' | 'Designer' | 'Business';

export interface Participant {
  name: string;
  role: Role | null;
  vote: string | null;
  spectator: boolean;
  joinedAt: number;
}

export type SessionStatus = 'voting' | 'revealed';

export interface AIPanelState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  ticketId: string;
  summary: string;
  fetchedAt: number;
  syncStatus: 'idle' | 'syncing' | 'done' | 'error';
  syncedAt: number;
  errorMessage?: string;
}

export interface Session {
  createdAt: number;
  expiresAt: number;
  status: SessionStatus;
  createdBy?: string;
  participants?: Record<string, Participant>;
  timer?: number | null;
  reactions?: Record<string, { emoji: string; ts: number }> | null;
  aiPanel?: AIPanelState;
}

// ─── MCP / Jira types ────────────────────────────────────────────────────────

export interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  description: string;
  acceptanceCriteria: string;
  comments: string[];
  status: string;
  issueType: string;
  labels: string[];
  components: string[];
  priority: string;
  storyPoints: number | null;
}

export interface PokerReadySummary {
  ticketKey: string;
  title: string;
  complexity: string[];
  risks: string[];
  requirements: string[];
  rawDescription: string;
}

// ─── MCP API request/response types ─────────────────────────────────────────

export interface JiraFetchRequest {
  mcpUrl: string;
  token: string;
  ticketId: string;
}

export interface JiraFetchResponse {
  ticket: JiraTicket;
  summary: PokerReadySummary;
}

export interface JiraSyncRequest {
  mcpUrl: string;
  token: string;
  ticketId: string;
  storyPoints: number;
  reasoning: string;
  teamSummary: string;
}

export interface JiraSyncResponse {
  success: boolean;
  message: string;
}

// ─── MCP credentials (sessionStorage only) ───────────────────────────────────

export interface MCPCredentials {
  mcpUrl: string;
  token: string;
}
