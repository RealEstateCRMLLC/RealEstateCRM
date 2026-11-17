/*************************************************
 * Regression: aicrm MCP tools must match the Prisma schema
 *
 * Contact has tenantId (not brokerageId), no city/state/isLead, and
 * agentId points at AgentProfile. The MCP executors were written
 * against an older schema, so list_contacts/get_contact/
 * create_contact/search_contacts/summarize all threw Prisma
 * validation errors at runtime. Executors must resolve the tenant
 * from the session brokerage and query by tenantId. (v0.67.6)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'apps/aicrm/src/lib/mcp/server.ts'), 'utf8');

test('mcp executors resolve tenant from brokerage and never query Contact by brokerageId', () => {
  assert.match(src, /tenantIdFor\(session\)/, 'executors must resolve tenantId from the session brokerage');
  assert.doesNotMatch(src, /prisma\.contact\.(findMany|findFirst|create|count)\(\{\s*(where|data):\s*\{[^}]*brokerageId/, 'Contact queries must not use brokerageId');
  assert.doesNotMatch(src, /assignedAgentId/, 'Contact.agentId is the schema field (AgentProfile), not assignedAgentId');
});
