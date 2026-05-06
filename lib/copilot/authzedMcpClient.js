import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const AUTHZED_MCP_URL = process.env.AUTHZED_MCP_URL || 'https://mcp.authzed.com';

function normalizeToolResult(toolName, result) {
    const content = Array.isArray(result?.content) ? result.content : [];
    const text = content
        .filter((item) => item?.type === 'text' && typeof item.text === 'string')
        .map((item) => item.text.trim())
        .filter(Boolean)
        .join('\n\n');

    return {
        toolName,
        summary: text || `${toolName} completed without text output.`,
        structuredContent: result?.structuredContent ?? null,
        content,
        isError: Boolean(result?.isError),
    };
}

export async function callAuthZedMcpTool(toolName, args = {}) {
    const client = new Client({
        name: 'saffron-authzed-mcp-client',
        version: '0.1.0',
    });

    const transport = new StreamableHTTPClientTransport(new URL(AUTHZED_MCP_URL));

    await client.connect(transport);

    try {
        const result = await client.callTool({
            name: toolName,
            arguments: args,
        });

        return normalizeToolResult(toolName, result);
    } finally {
        await client.close().catch(() => undefined);
    }
}