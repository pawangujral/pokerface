import { NextRequest, NextResponse } from 'next/server';
import { createMCPClient, callMCPTool } from '@/lib/mcp/client';
import type { JiraSyncRequest, JiraSyncResponse } from '@/types';

export async function POST(req: NextRequest) {
  let body: JiraSyncRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { mcpUrl, token, ticketId, storyPoints, reasoning, teamSummary } = body;
  if (!mcpUrl || !token || !ticketId || storyPoints == null) {
    return NextResponse.json(
      { error: 'mcpUrl, token, ticketId, and storyPoints are required' },
      { status: 400 },
    );
  }

  let client;
  try {
    client = await createMCPClient(mcpUrl, token);
  } catch (err) {
    console.error('[jira-sync] MCP connect failed:', err);
    return NextResponse.json({ error: 'Failed to connect to MCP server' }, { status: 502 });
  }

  try {
    // 1. Update story points field
    await callMCPTool(client, 'update_issue', {
      issueIdOrKey: ticketId,
      fields: { story_points: storyPoints },
    });

    // 2. Post a comment with the team's reasoning
    const comment = buildComment(storyPoints, reasoning, teamSummary);
    await callMCPTool(client, 'add_comment', {
      issueIdOrKey: ticketId,
      body: comment,
    });

    const response: JiraSyncResponse = {
      success: true,
      message: `Story points set to ${storyPoints} and comment posted on ${ticketId}.`,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[jira-sync] MCP tool call failed:', err);
    return NextResponse.json({ error: 'Failed to sync to Jira via MCP server' }, { status: 502 });
  } finally {
    await client.close().catch(() => {});
  }
}

function buildComment(storyPoints: number, reasoning: string, teamSummary: string): string {
  const lines = [
    `*📊 Story Points agreed: ${storyPoints}*`,
    '',
    '*Team reasoning:*',
    reasoning || '_No reasoning recorded._',
  ];

  if (teamSummary) {
    lines.push('', '*AI Poker-Ready Summary (context used during estimation):*', teamSummary);
  }

  lines.push('', '_Synced via PokerFace AI Engineering Partner_');
  return lines.join('\n');
}
