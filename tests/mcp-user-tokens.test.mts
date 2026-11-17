/*************************************************
 * Per-user MCP tokens (BYO-AI Phase 18)
 *
 * Tokens are random, stored only as SHA-256 hashes, verified in
 * constant time, and scoped to one user (generate rotates,
 * revoke kills). Plaintext must never be recoverable from the
 * stored record.
 *************************************************/

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const tmpFile = path.join(os.tmpdir(), `mcp-tokens-test-${Date.now()}.json`);
process.env.MCP_TOKENS_FILE = tmpFile;

const { generateUserToken, verifyUserToken, revokeUserToken, hashToken, getUserTokenMeta } =
  await import('../src/lib/mcp/user-tokens.ts');

before(async () => {
  await fs.rm(tmpFile, { force: true });
});

test('generated token verifies, wrong token does not', async () => {
  const { plaintext, record } = await generateUserToken('user-1', 'a@test.local');
  assert.ok(plaintext.startsWith('recm_'));
  assert.notEqual(record.tokenHash, plaintext);
  assert.equal(record.tokenHash, hashToken(plaintext));

  const ok = await verifyUserToken(plaintext);
  assert.equal(ok?.userId, 'user-1');
  assert.equal(await verifyUserToken('recm_wrong-token-value'), null);
  assert.equal(await verifyUserToken('not-a-token'), null);
});

test('rotate replaces and revoke kills the token', async () => {
  const first = await generateUserToken('user-2', 'b@test.local');
  const second = await generateUserToken('user-2', 'b@test.local');
  assert.equal(await verifyUserToken(first.plaintext), null, 'rotated-out token must die');
  assert.equal((await verifyUserToken(second.plaintext))?.userId, 'user-2');

  assert.equal(await revokeUserToken('user-2'), true);
  assert.equal(await verifyUserToken(second.plaintext), null);
  assert.equal(await getUserTokenMeta('user-2'), null);
});
