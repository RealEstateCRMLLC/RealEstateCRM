/*************************************************
 * LeadCaller MCP voice tools (BYO-AI Phase 18)
 *
 * An AI connected over MCP may place outbound calls ONLY
 * through start_outbound_call, which must:
 *  - require explicit operator confirmation (confirm: true),
 *  - refuse when Vapi is not configured (never silently fall
 *    back to a mock call or a placeholder phone number),
 *  - exclude Do-Not-Contact leads from callable lists.
 * (v0.67.11)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mcp = readFileSync(join(root, 'apps/leadcaller/src/pages/api/mcp.ts'), 'utf8');
const adapters = readFileSync(join(root, 'apps/leadcaller/src/lib/adapters/index.ts'), 'utf8');

test('leadcaller MCP exposes callable-lead, gated-call, and call-history tools', () => {
  for (const name of ['list_callable_leads', 'start_outbound_call', 'get_lead_call_history']) {
    assert.match(mcp, new RegExp(`name: "${name}"`), `missing MCP tool ${name}`);
  }
});

test('start_outbound_call is approval-gated and configuration-checked', () => {
  assert.match(mcp, /confirm/, 'must require an explicit confirm flag');
  assert.match(mcp, /not configured|not set|missing/i, 'must refuse honestly when telephony is unconfigured');
});

test('callable lists exclude Do Not Contact and placeholder phone id is gone', () => {
  assert.match(mcp, /Do Not Contact/, 'callable leads must exclude DNC status');
  assert.doesNotMatch(adapters, /your-vapi-phone-number-id/, 'placeholder Vapi phone number id must not ship');
});
