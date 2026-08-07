// MCP provider definitions — each provider has tools and optional credentials

export interface MCPProvider {
  id: string
  name: string
  description: string
  icon: string
  tools: MCPToolDef[]
  credentials?: MCPCredential[]
  // A "managed" provider is hosted by Relay itself: credentials live in server
  // env vars (never in the DB) and access is gated by the subscription plan.
  // The settings UI must NOT show credential inputs for managed providers.
  managed?: boolean
}

export interface MCPToolDef {
  id: string
  name: string
  description: string
}

export interface MCPCredential {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder: string
  required: boolean
  description?: string
}

export const MCP_PROVIDERS: MCPProvider[] = [
  {
    id: 'web',
    name: 'Web Search & Fetch',
    description: 'Search the web and read pages',
    icon: 'globe',
    tools: [
      { id: 'web-search', name: 'Web Search', description: 'Search DuckDuckGo for instant answers' },
      { id: 'web-fetch', name: 'Web Fetch', description: 'Fetch and read any web page' },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Search code, read repos and files',
    icon: 'github',
    tools: [
      { id: 'github-search', name: 'GitHub Search', description: 'Search code, issues, PRs' },
      { id: 'github-read', name: 'GitHub Read', description: 'Read files from repos' },
    ],
    credentials: [
      {
        key: 'GITHUB_TOKEN',
        label: 'GitHub Token',
        type: 'password',
        placeholder: 'ghp_xxxxxxxxxxxx',
        required: true,
        description: 'Personal access token from GitHub Settings → Developer settings',
      },
    ],
  },
  {
    id: 'phone',
    name: 'Phone Calls',
    description: 'AI-powered outbound calls — included on Pro & Unlimited',
    icon: 'phone',
    tools: [
      { id: 'phone-call', name: 'Phone Call', description: 'Place AI phone calls (managed by Relay)' },
    ],
    // Managed provider: credentials are hosted by Relay (server-side env),
    // gated by subscription plan. Users never see or enter Vapi tokens.
    managed: true,
  },
]

// Flatten all tools from all providers for the AI
export const ALL_TOOL_IDS = MCP_PROVIDERS.flatMap(p => p.tools.map(t => t.id))

export function getProviderForTool(toolId: string): MCPProvider | undefined {
  return MCP_PROVIDERS.find(p => p.tools.some(t => t.id === toolId))
}

// Build the credential env map: given a user's mcp_config, produce a record of env vars
export function buildCredEnv(mcpConfig: Record<string, Record<string, string>>): Record<string, string> {
  const env: Record<string, string> = {}
  for (const provider of MCP_PROVIDERS) {
    if (!provider.credentials) continue
    const userCreds = mcpConfig[provider.id]
    if (!userCreds) continue
    for (const cred of provider.credentials) {
      if (userCreds[cred.key]) env[cred.key] = userCreds[cred.key]
    }
  }
  return env
}