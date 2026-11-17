/*************************************************
 * LeadCaller MCP must require authentication
 *
 * The SSE MCP endpoint had NO auth at all: anyone could list
 * callable leads (names + phone numbers) and read call history.
 * It must accept only a NextAuth session cookie or the
 * LC_MCP_TOKEN bearer. (v0.67.19)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'apps/leadcaller/src/pages/api/mcp.ts'), 'utf8');

test('leadcaller MCP gates on session or LC_MCP_TOKEN bearer', () => {
  assert.match(src, /getToken/, 'must verify the NextAuth session token');
  assert.match(src, /LC_MCP_TOKEN/, 'must support the service bearer token');
  assert.match(src, /401/, 'must reject unauthenticated callers with 401');
});
