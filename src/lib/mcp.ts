export interface MCPTool { id: string; name: string; description: string; category: 'code' | 'web' | 'github' | 'files' | 'phone'; enabled: boolean }
export const AVAILABLE_TOOLS: MCPTool[] = [
  { id: 'github-search', name: 'GitHub Search', description: 'Search code, issues, PRs on GitHub', category: 'github', enabled: true },
  { id: 'github-read', name: 'GitHub Read', description: 'Read files and repos from GitHub', category: 'github', enabled: true },
  { id: 'web-search', name: 'Web Search', description: 'Search the web for information', category: 'web', enabled: true },
  { id: 'web-fetch', name: 'Web Fetch', description: 'Fetch and read web pages', category: 'web', enabled: true },
  { id: 'file-read', name: 'File Read', description: 'Read files from your workspace', category: 'files', enabled: true },
  { id: 'file-write', name: 'File Write', description: 'Write and edit files', category: 'files', enabled: true },
  { id: 'file-glob', name: 'File Search', description: 'Search files by pattern', category: 'files', enabled: true },
  { id: 'phone-call', name: 'Phone Call', description: 'Make AI-powered phone calls via Vapi', category: 'phone', enabled: true },
]
export async function executeTool(toolId: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toolId, params }) })
  if (!res.ok) throw new Error(`Tool ${toolId} failed: ${res.statusText}`)
  return res.json()
}