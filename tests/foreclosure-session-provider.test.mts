/*************************************************
 * Regression: foreclosure SessionProvider basePath
 *
 * Foreclosure is mounted at /foreclosure. Its next-auth/react
 * SessionProvider must point at the app's own auth routes
 * (/foreclosure/api/auth). Bare <Provider> defaults to the domain-root
 * /api/auth (the MAIN CRM), whose NextAuth deletes the unrecognized
 * foreclosure session cookie on every page load - users could log in
 * (API 200) yet bounce off every protected page. Pinned at v0.67.6.
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(
  join(root, 'apps/foreclosureworkflow/src/app/SessionProvider.tsx'),
  'utf8',
);

test('foreclosure SessionProvider pins basePath to its own auth routes', () => {
  assert.match(
    src,
    /basePath\s*=\s*["']\/foreclosure\/api\/auth["']/,
    'SessionProvider must use basePath="/foreclosure/api/auth" or the main CRM session endpoint will delete foreclosure sessions',
  );
});
