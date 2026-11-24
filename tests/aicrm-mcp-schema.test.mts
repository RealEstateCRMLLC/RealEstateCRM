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

test('update_lead_stage resolves stageName and never silently no-ops', () => {
  // stageName used to be an ignored argument: callers got a 200 with
  // the unchanged lead. It must resolve by name, and an update with
  // nothing to change must be an error, not fake success.
  assert.match(src, /args\['stageName'\]/, 'stageName must be handled, not dropped');
  assert.match(src, /pipelineStage\.findFirst/, 'stageName must resolve to a real PipelineStage');
  assert.match(src, /Nothing to update/, 'an empty update must error');
  assert.match(src, /Invalid status/, 'status must be validated against the enum');
});

test('get_contact and log_activity can never widen an undefined id into a first-record answer', () => {
  // Prisma treats an undefined where-field as "no filter": a missing
  // id returned (or logged against) the tenant's FIRST contact.
  assert.match(src, /get_contact requires a contact id/);
  assert.match(src, /log_activity requires a contactId/);
  assert.match(src, /Contact "\$\{id\}" not found/, 'a nonexistent contact must be an error, not null');
});

test('mcp executors resolve tenant from brokerage and never query Contact by brokerageId', () => {
  assert.match(src, /tenantIdFor\(session\)/, 'executors must resolve tenantId from the session brokerage');
  assert.doesNotMatch(src, /prisma\.contact\.(findMany|findFirst|create|count)\(\{\s*(where|data):\s*\{[^}]*brokerageId/, 'Contact queries must not use brokerageId');
  assert.doesNotMatch(src, /assignedAgentId/, 'Contact.agentId is the schema field (AgentProfile), not assignedAgentId');
});
