import { NextRequest, NextResponse } from 'next/server';
import { createMCPClient, callMCPTool } from '@/lib/mcp/client';
import { buildPokerReadySummary } from '@/lib/mcp/summary';
import type { JiraFetchRequest, JiraFetchResponse, JiraTicket } from '@/types';

export async function POST(req: NextRequest) {
  let body: JiraFetchRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { mcpUrl, token, ticketId } = body;
  if (!mcpUrl || !token || !ticketId) {
    return NextResponse.json({ error: 'mcpUrl, token, and ticketId are required' }, { status: 400 });
  }

  let client;
  try {
    client = await createMCPClient(mcpUrl, token);
  } catch (err) {
    console.error('[jira-fetch] MCP connect failed:', err);
    return NextResponse.json({ error: 'Failed to connect to MCP server' }, { status: 502 });
  }

  try {
    const raw = await callMCPTool(client, 'get_issue', { issueIdOrKey: ticketId });
    const ticket = normalizeMCPIssue(ticketId, raw);
    const summary = buildPokerReadySummary(ticket);

    const response: JiraFetchResponse = { ticket, summary };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[jira-fetch] MCP tool call failed:', err);
    return NextResponse.json({ error: 'Failed to fetch Jira ticket from MCP server' }, { status: 502 });
  } finally {
    await client.close().catch(() => {});
  }
}

// Normalizes the raw MCP tool response into our JiraTicket shape.
// Jira MCP servers vary — this handles common field layouts.
function normalizeMCPIssue(fallbackKey: string, raw: unknown): JiraTicket {
  const r = raw as Record<string, unknown>;

  // Some MCP servers return an array of content blocks; unwrap if so
  const issue = (Array.isArray(r) ? (r[0] as Record<string, unknown>) : r) as Record<string, unknown>;
  const fields = (issue.fields ?? issue) as Record<string, unknown>;

  function str(v: unknown): string {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && 'content' in v) return String((v as Record<string, unknown>).content ?? '');
    return '';
  }

  const comments: unknown[] = (fields.comments as unknown[]) ?? (fields.comment as Record<string, unknown[]>)?.comments ?? [];

  return {
    id:                 str(issue.id ?? issue.key ?? fallbackKey),
    key:                str(issue.key ?? fallbackKey),
    summary:            str(fields.summary ?? issue.summary),
    description:        str(fields.description ?? issue.description),
    acceptanceCriteria: str(fields.acceptanceCriteria ?? fields['acceptance_criteria'] ?? ''),
    comments:           comments.map((c) => str((c as Record<string, unknown>)?.body ?? c)),
    status:             str((fields.status as Record<string, unknown>)?.name ?? fields.status),
    issueType:          str((fields.issuetype as Record<string, unknown>)?.name ?? fields.issueType ?? 'Story'),
    labels:             Array.isArray(fields.labels) ? fields.labels.map(String) : [],
    components:         Array.isArray(fields.components)
                          ? fields.components.map((c) => str((c as Record<string, unknown>)?.name ?? c))
                          : [],
    priority:           str((fields.priority as Record<string, unknown>)?.name ?? fields.priority ?? 'Medium'),
    storyPoints:        typeof fields.story_points === 'number' ? fields.story_points
                          : typeof fields.customfield_10016 === 'number' ? fields.customfield_10016 : null,
  };
}
