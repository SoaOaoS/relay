// MCP provider definitions — each provider has tools and optional credentials

export interface MCPProvider {
  id: string
  name: string
  description: string
  icon: string
  tools: MCPToolDef[]
  credentials?: MCPCredential[]
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
    id: 'files',
    name: 'File Operations',
    description: 'Read, write, and search files',
    icon: 'file',
    tools: [
      { id: 'file-read', name: 'File Read', description: 'Read files from workspace' },
      { id: 'file-write', name: 'File Write', description: 'Write and edit files' },
      { id: 'file-glob', name: 'File Search', description: 'Find files by pattern' },
    ],
  },
  {
    id: 'phone',
    name: 'Phone Calls',
    description: 'AI-powered outbound calls via Vapi',
    icon: 'phone',
    tools: [
      { id: 'phone-call', name: 'Phone Call', description: 'Place AI phone calls' },
    ],
    credentials: [
      { key: 'VAPI_TOKEN', label: 'Vapi Token', type: 'password', placeholder: 'xxxxxxxx-xxxx-xxxx', required: true },
      { key: 'VAPI_PHONE_NUMBER_ID', label: 'Phone Number ID', type: 'text', placeholder: 'xxxxxxxx', required: true },
      { key: 'VAPI_ASSISTANT_ID', label: 'Assistant ID', type: 'text', placeholder: 'xxxxxxxx', required: true },
    ],
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