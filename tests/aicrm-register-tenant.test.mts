/*************************************************
 * Regression: aicrm registration must create a Tenant
 *
 * Brokerage.tenantId is required (Brokerage -> Tenant). The register
 * route created the Brokerage without any tenant, so every signup
 * 500'd with Prisma "Argument `tenant` is missing". The route must
 * create the Tenant first and connect the Brokerage to it. (v0.67.6)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(
  join(root, 'apps/aicrm/src/app/api/auth/register/route.ts'),
  'utf8',
);

test('aicrm register creates a tenant and connects the brokerage to it', () => {
  assert.match(src, /prisma\.tenant\.create/, 'register must create a Tenant');
  assert.match(src, /tenantId:\s*tenant\.id/, 'brokerage.create must pass tenantId: tenant.id');
});
