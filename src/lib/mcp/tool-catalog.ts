/**
 * Tool discovery catalog (pure - unit-tested).
 *
 * The seed of HyperNexus tool-drop routing: an AI connected to one
 * CRM MCP server can ask find_tools("call a lead") and learn not
 * only the local matches but WHICH sibling server holds the voice
 * tools and how to reach it. Ranking is simple keyword overlap -
 * deliberately transparent, no embeddings required.
 */

export interface ToolLike {
  name: string;
  description: string;
}

export interface SiblingServer {
  server: string;
  endpoint: string;
  transport: string;
  auth: string;
  keywords: string[];
  tools: string[];
  note: string;
}

export const SIBLING_SERVERS: SiblingServer[] = [
  {
    server: 'leadcaller',
    endpoint: '/leadcaller/api/mcp',
    transport: 'SSE (GET stream, then POST to the session endpoint it returns)',
    auth: 'LeadCaller NextAuth session cookie, or Authorization: Bearer <LC_MCP_TOKEN> (service token)',
    keywords: ['call', 'voice', 'dial', 'phone', 'outbound', 'vapi', 'mls', 'inventory', 'availability', 'calendar'],
    tools: ['query_mls_inventory', 'list_callable_leads', 'start_outbound_call', 'get_lead_call_history', 'check_agent_availability'],
    note: 'Voice/lead-calling tools. start_outbound_call is approval-gated (confirm:true) and refuses when telephony is unconfigured.',
  },
  {
    server: 'aicrm',
    endpoint: '/aicrm/api/mcp',
    transport: 'HTTP POST JSON-RPC',
    auth: 'aicrm-session cookie (register/login at /aicrm) or Bearer MCP_TOKEN when set',
    keywords: ['pipeline', 'stage', 'brokerage', 'property', 'properties', 'summarize brokerage'],
    tools: ['list_contacts', 'get_contact', 'create_contact', 'update_lead_stage', 'list_properties', 'create_task', 'list_tasks', 'summarize_brokerage', 'search_contacts', 'log_activity'],
    note: 'Brokerage-scoped CRM variant with pipeline stages and properties.',
  },
];

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9_]+/).filter((t) => t.length > 2);
}

/** Rank local tools by keyword overlap with the query. */
export function rankTools<T extends ToolLike>(query: string, tools: T[]): { tool: T; score: number }[] {
  const q = new Set(tokens(query));
  return tools
    .map((tool) => {
      const hay = new Set([...tokens(tool.name.replace(/_/g, ' ')), ...tokens(tool.description)]);
      let score = 0;
      for (const t of q) if (hay.has(t)) score += 1;
      if (tool.name.toLowerCase().includes(query.toLowerCase().trim()) && query.trim().length > 2) score += 3;
      return { tool, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Sibling servers whose keyword space matches the query. */
export function matchSiblings(query: string): SiblingServer[] {
  const q = new Set(tokens(query));
  return SIBLING_SERVERS.filter((s) => s.keywords.some((k) => q.has(k) || query.toLowerCase().includes(k)));
}
