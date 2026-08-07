import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

export interface UserMCPServer {
  id: string
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
}

export interface DiscoveredTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  serverName: string
}

export interface MCPClientResult {
  tools: DiscoveredTool[]
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>
  cleanup: () => Promise<void>
}

// Connect to a single MCP server and return its tools + a call function
async function connectServer(server: UserMCPServer): Promise<{ client: Client; transport: Transport; tools: DiscoveredTool[]; serverName: string } | null> {
  try {
    let transport: Transport

    if (server.command.startsWith('http://') || server.command.startsWith('https://')) {
      // HTTP/SSE transport for remote MCP servers
      if (server.command.includes('/sse')) {
        transport = new SSEClientTransport(new URL(server.command))
      } else {
        transport = new StreamableHTTPClientTransport(new URL(server.command))
      }
    } else {
      // Stdio transport for local command-based MCP servers
      transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
        env: { ...process.env, ...server.env } as Record<string, string>,
      })
    }

    const client = new Client({
      name: 'relay',
      version: '0.1.0',
    }, {
      capabilities: {},
    })

    await client.connect(transport)
    const { tools } = await client.listTools()

    return {
      client,
      transport,
      serverName: server.name,
      tools: (tools || []).map(t => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema as Record<string, unknown>,
        serverName: server.name,
      })),
    }
  } catch (e) {
    console.error(`[MCP] Failed to connect to server "${server.name}":`, e instanceof Error ? e.message : String(e))
    return null
  }
}

// Connect to all user's MCP servers, discover tools, and return a unified interface
export async function connectMCPClient(servers: UserMCPServer[]): Promise<MCPClientResult> {
  const connected: { client: Client; transport: Transport; tools: DiscoveredTool[]; serverName: string }[] = []
  const toolMap = new Map<string, { client: Client; serverName: string }>()

  for (const server of servers) {
    if (!server.enabled) continue
    const conn = await connectServer(server)
    if (!conn) continue
    connected.push(conn)
    for (const tool of conn.tools) {
      toolMap.set(`${tool.serverName}__${tool.name}`, { client: conn.client, serverName: conn.serverName })
    }
  }

  return {
    tools: connected.flatMap(c => c.tools),
    callTool: async (fullToolName: string, args: Record<string, unknown>): Promise<string> => {
      const entry = toolMap.get(fullToolName)
      if (!entry) return JSON.stringify({ error: `Tool ${fullToolName} not found` })
      const toolName = fullToolName.split('__').slice(1).join('__')
      try {
        const result = await entry.client.callTool({ name: toolName, arguments: args })
        const content = (result.content as { type: string; text: string }[]) || []
        const textParts = content.filter(c => c.type === 'text').map(c => c.text)
        return textParts.join('\n') || JSON.stringify(result)
      } catch (e) {
        return JSON.stringify({ error: `Tool call failed: ${e instanceof Error ? e.message : String(e)}` })
      }
    },
    cleanup: async () => {
      for (const conn of connected) {
        try { await conn.client.close() } catch { /* ignore */ }
        try { await conn.transport.close() } catch { /* ignore */ }
      }
    },
  }
}

// Convert discovered MCP tools to OpenAI/Ollama tool definitions
export function mcpToolsToDefinitions(tools: DiscoveredTool[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: `${t.serverName}__${t.name}`,
      description: `[${t.serverName}] ${t.description}`,
      parameters: t.inputSchema,
    },
  }))
}