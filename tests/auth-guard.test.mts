import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

// Guards the v0.59.0-class regression: no hardcoded credential may grant a
// session in src/lib/auth.ts. Privileged demo/universal logins must be
// env-gated so production (env unset) has them disabled.
const authSrc = readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8');

test('auth.ts contains no hardcoded universal-admin password', () => {
  assert.ok(!authSrc.includes("'admin123'"), 'hardcoded admin123 literal present');
  assert.ok(
    authSrc.includes('AUTH_UNIVERSAL_ADMIN_PASSWORD'),
    'universal-admin login must require AUTH_UNIVERSAL_ADMIN_PASSWORD env',
  );
});

test('universal-admin branch checks the env password before returning a session', () => {
  const idx = authSrc.indexOf('universal-admin');
  assert.ok(idx > 0, 'universal-admin branch missing');
  const gateIdx = authSrc.indexOf('AUTH_UNIVERSAL_ADMIN_PASSWORD');
  assert.ok(gateIdx > 0 && gateIdx < idx, 'env gate must precede the universal-admin session return');
});
