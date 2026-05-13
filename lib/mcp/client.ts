import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * Creates a short-lived MCP client connected to the provided endpoint.
 * Credentials are passed per-request and never stored server-side.
 */
export async function createMCPClient(mcpUrl: string, token: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const client = new Client(
    { name: 'pokerface-proxy', version: '3.1.0' },
  );

  await client.connect(transport);
  return client;
}

/**
 * Calls a tool on the MCP server and returns the result content.
 */
export async function callMCPTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await client.callTool({ name: toolName, arguments: args });
  return result.content;
}
