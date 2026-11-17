/*************************************************
 * ContentPlanner credentials auth must verify something
 *
 * The credentials provider looked a user up by email and returned
 * it WITHOUT comparing passwords (the User model has no password
 * field) - knowing any registered email was a full impersonation
 * login. With no password system, credentials may only succeed via
 * the explicit local demo opt-in; DB users sign in via GitHub.
 * Also pins the mount-aware sign-in redirect. (v0.67.15)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const auth = readFileSync(join(root, 'apps/contentplanner/apps/web/src/lib/auth.ts'), 'utf8');
const mw = readFileSync(join(root, 'apps/contentplanner/apps/web/src/middleware.ts'), 'utf8');

test('credentials authorize never returns a DB user without verification', () => {
  assert.doesNotMatch(
    auth,
    /if \(user\) \{\s*return \{ id: user\.id/,
    'unconditional DB-user return = email-only impersonation',
  );
  assert.match(auth, /demoLoginEnabled/, 'only the gated demo path may authenticate credentials');
});

test('contentplanner sign-in redirect is mount-aware', () => {
  assert.match(mw, /NEXTAUTH_URL/, 'signIn must derive from NEXTAUTH_URL so the /contentplanner prefix survives nginx');
});
