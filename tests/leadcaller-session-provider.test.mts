/*************************************************
 * LeadCaller must pin its NextAuth basePath (v0.67.27)
 *
 * The app is mounted at /leadcaller but its root layout had no
 * SessionProvider, so next-auth/react posted sign-ins to the
 * DOMAIN-ROOT /api/auth/* (the main CRM) and every UI login failed
 * with "Invalid email or password" while the same credentials
 * worked via /leadcaller/api/auth directly. The provider wrapper
 * must exist with the mount pinned, and the root layout must use it.
 * (Foreclosure got this fix earlier; LeadCaller was missed.)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const provider = readFileSync(join(root, 'apps/leadcaller/src/app/SessionProvider.tsx'), 'utf8');
const layout = readFileSync(join(root, 'apps/leadcaller/src/app/layout.tsx'), 'utf8');

test('leadcaller SessionProvider pins the /leadcaller auth basePath', () => {
  assert.match(provider, /basePath="\/leadcaller\/api\/auth"/);
});

test('leadcaller root layout wraps the app in the SessionProvider', () => {
  assert.match(layout, /<SessionProvider>/);
  assert.match(layout, /from "\.\/SessionProvider"/);
});

test('leadg has the same pinned provider (same disease, same fix)', () => {
  const lgProvider = readFileSync(join(root, 'apps/leadg/src/app/SessionProvider.tsx'), 'utf8');
  const lgLayout = readFileSync(join(root, 'apps/leadg/src/app/layout.tsx'), 'utf8');
  assert.match(lgProvider, /basePath="\/leadg\/api\/auth"/);
  assert.match(lgLayout, /<SessionProvider>/);
});

test('leadcaller dialer only fetches a voice token when signed in', () => {
  const dialer = readFileSync(join(root, 'apps/leadcaller/src/components/NativeDialer.tsx'), 'utf8');
  assert.match(dialer, /sessionStatus !== 'authenticated'/, 'globally-mounted dialer must not 401 on the login page');
});
