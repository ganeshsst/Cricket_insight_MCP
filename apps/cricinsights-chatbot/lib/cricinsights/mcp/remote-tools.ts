import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const mcpServerUrl = process.env.MCP_SERVER_URL;

function createMcpClient() {
  if (!mcpServerUrl) {
    throw new Error('MCP_SERVER_URL is required to use cricket tools.');
  }

  const client = new Client({
    name: 'cricinsights-chat',
    version: '1.0.0',
  });
  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl), {
    requestInit: { cache: 'no-store' },
  });
  return { client, transport };
}

async function withMcpClient<T>(run: (client: Client) => Promise<T>) {
  const { client, transport } = createMcpClient();
  try {
    await client.connect(transport);
    return await run(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

function parseToolText(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractToolResult(result: Awaited<ReturnType<Client['callTool']>>) {
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content
    .filter(
      (item): item is { type: 'text'; text: string } =>
        typeof item === 'object' &&
        item !== null &&
        'type' in item &&
        item.type === 'text' &&
        'text' in item &&
        typeof item.text === 'string',
    )
    .map((item) => item.text)
    .join('\n');

  return text ? parseToolText(text) : result;
}

export async function listRemoteMcpTools() {
  return withMcpClient(async (client) => {
    const result = await client.listTools();
    return result.tools;
  });
}

export async function callRemoteMcpTool(
  name: string,
  args: Record<string, unknown>,
) {
  return withMcpClient(async (client) => {
    const result = await client.callTool({ name, arguments: args });
    return extractToolResult(result);
  });
}
