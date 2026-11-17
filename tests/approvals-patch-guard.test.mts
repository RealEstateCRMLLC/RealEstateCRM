/*************************************************
 * Approvals PATCH must be workspace-scoped and final (v0.67.24)
 *
 * The decide endpoint used to findUnique ANY activity by id and
 * uppercase whatever `action` string arrived into its status: any
 * signed-in user could rewrite another workspace's approval (or a
 * non-approval activity), set status "BANANA", and flip decided
 * approvals back and forth. It now scopes by workspace + type,
 * whitelists approve/reject into APPROVED/REJECTED, and 409s on an
 * already-decided approval.
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const route = readFileSync(join(root, 'src/app/api/approvals/route.ts'), 'utf8');
const patch = route.slice(route.indexOf('export async function PATCH'));

test('PATCH scopes the lookup to the caller workspace and APPROVAL type', () => {
  assert.match(patch, /where: \{ id, workspaceId: workspace\.id, type: 'APPROVAL' \}/);
  assert.doesNotMatch(patch, /activity\.findUnique\(\{ where: \{ id \} \}\)/, 'unscoped by-id lookup must stay gone');
});

test('PATCH whitelists the decision and stores canonical statuses', () => {
  assert.match(patch, /decision !== 'approve' && decision !== 'reject'/);
  assert.match(patch, /decision === 'approve' \? 'APPROVED' : 'REJECTED'/);
  assert.doesNotMatch(patch, /action\.toUpperCase\(\)/, 'raw action must never become the stored status');
});

test('PATCH refuses to re-decide a decided approval', () => {
  assert.match(patch, /content\.status !== 'PENDING'/);
  assert.match(patch, /status: 409/);
});
