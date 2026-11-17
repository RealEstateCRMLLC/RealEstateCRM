/**
 * AgentCore intent definitions (pure - no DB, no LLM).
 *
 * Split from engine.ts so intent parsing is unit-testable without
 * importing Prisma or provider clients. engine.ts maps these intent
 * names to executors; this module owns ONLY pattern matching and
 * LLM-reply parsing.
 */

// Maps numbered capture groups to named params per intent
export const GROUP_MAP: Record<string, string[]> = {
  update_lead_stage: ['lead', 'stage'],
  create_task: ['title', 'when'],
  get_contact: ['id'],
  negotiate: ['topic'],
  draft: ['kind', 'topic'],
};

export interface IntentPattern {
  intent: string;
  patterns: RegExp[];
}

export const INTENT_PATTERNS: IntentPattern[] = [
  { intent: 'update_lead_stage', patterns: [
    /update\s+(?:lead\s+)?(\S+)\s+to\s+(hot|cold|active|new|closed won|closed lost|won|lost|contacted)/i,
    /set\s+(?:lead\s+)?(\S+)\s+(?:stage|status)\s+to\s+(hot|cold|active|new|closed won|closed lost|won|lost|contacted)/i,
    /mark\s+(?:lead\s+)?(\S+)\s+as\s+(hot|cold|active|new|closed won|closed lost|won|lost|contacted)/i,
  ] },
  { intent: 'create_task', patterns: [
    /(?:create|add|schedule)\s+(?:a\s+)?task\s+(?:to\s+)?(.+?)(?:\s+(?:for|due|when|at)\s+(.+))?$/i,
    /remind\s+me\s+to\s+(.+)/i,
  ] },
  { intent: 'list_contacts', patterns: [ /(?:list|show|get|display)\s+(?:all\s+)?(?:my\s+)?contacts/i, /who\s+are\s+my\s+(?:recent\s+)?contacts/i ] },
  { intent: 'summarize_workspace', patterns: [ /(?:summarize|summary|overview|dashboard|stats|status)\s+(?:of\s+)?(?:my\s+)?(?:workspace|business|crm|pipeline|account)/i, /(?:show|display|give|tell)\b.*\b(?:summary|overview|stats)\b/i ] },
  { intent: 'list_tasks', patterns: [ /(?:list|show|get|display)\s+(?:all\s+)?(?:my\s+)?tasks/i, /what\s+are\s+my\s+(?:pending\s+)?tasks/i ] },
  // Possessives/determiners are not contact names ("show my ..." used to
  // look up a contact literally named "my").
  { intent: 'get_contact', patterns: [ /(?:get|show|display)\s+(?:contact\s+)?(?!my\b|the\b|all\b|me\b)(\S+)\s+(?:details|info|profile)?/i, /lookup\s+(?:contact\s+)?(?!my\b|the\b|all\b)(\S+)/i ] },
  { intent: 'negotiate', patterns: [ /(?:advise|negotiate|should\s+i\s+counter|what\s+should\s+i\s+offer)(?:\s+on)?\s+(.+)/i, /negotiation\s+(?:advice|advisor)\s+(?:for|on)\s+(.+)/i ] },
  { intent: 'draft', patterns: [ /(?:draft|write|compose)\s+(?:an?\s+)?(email|sms|text|message|letter)\s+(?:to\s+\S+\s+)?(?:about|for|saying)\s+(.+)/i ] },
];

export function detectIntent(command: string): { intent: string; params: Record<string, string> } | null {
  for (const rule of INTENT_PATTERNS) {
    for (const pattern of rule.patterns) {
      const match = command.match(pattern);
      if (match) {
        const params: Record<string, string> = {};
        const names = GROUP_MAP[rule.intent] || [];
        for (let i = 1; i < match.length; i++) {
          const value = match[i];
          if (value && names[i - 1]) params[names[i - 1]] = value.trim();
        }
        return { intent: rule.intent, params };
      }
    }
  }
  return null;
}

/**
 * LLM intent whitelist: the model may only pick one of these
 * READ-ONLY executors. Writes stay on the deterministic rule path
 * (auditable patterns), never free-form from the model.
 */
export const INTERPRETED_INTENTS = [
  'summarize_workspace',
  'list_contacts',
  'list_leads',
  'count_hot_leads',
  'list_tasks',
  'get_contact',
  'unknown',
] as const;

/** Parse the model's JSON reply into a whitelisted intent (pure, unit-tested). */
export function parseInterpretedIntent(text: string | null): { intent: string; params: Record<string, string>; message?: string } | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { intent?: string; params?: Record<string, unknown>; message?: string; name?: string; status?: string };
    const intent = (parsed.intent || '').toLowerCase();
    if (!(INTERPRETED_INTENTS as readonly string[]).includes(intent)) {
      return { intent: 'unknown', params: {}, message: parsed.message };
    }
    const params: Record<string, string> = {};
    if (parsed.params && typeof parsed.params === 'object') {
      for (const [k, v] of Object.entries(parsed.params)) {
        if (typeof v === 'string') params[k] = v;
      }
    }
    // Models often put fields at the top level instead of under params.
    if (typeof parsed.name === 'string') params['id'] = parsed.name;
    if (typeof parsed.status === 'string') params['status'] = parsed.status;
    return { intent, params, message: parsed.message };
  } catch {
    return null;
  }
}
