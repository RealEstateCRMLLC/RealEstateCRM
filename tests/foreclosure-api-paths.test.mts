/*************************************************
 * Foreclosure client fetches must be mount-aware (v0.67.26)
 *
 * The app is mounted at /foreclosure (Next basePath + nginx). Its
 * client components called fetch("/api/...") root-absolute, which
 * resolves to the MAIN CRM at the domain root — every write (create
 * lead, notes, tasks, SMS/email, enroll, tags, documents, contacts,
 * relatives, enrich, CSV import, users, settings) got the main app's
 * 401 and silently failed. The apiUrl() helper existed for exactly
 * this but was only wired into 3 files. All client API fetches must
 * go through it.
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fcSrc = join(root, 'apps/foreclosureworkflow/src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

test('no foreclosure client file fetches a root-absolute /api path', () => {
  const offenders: string[] = [];
  for (const file of walk(fcSrc)) {
    if (file.endsWith('api-base.ts')) continue;
    const src = readFileSync(file, 'utf8');
    if (/fetch\(\s*["']\/api\//.test(src)) offenders.push(file.replace(fcSrc, ''));
  }
  assert.deepEqual(offenders, [], `root-absolute fetches hit the main CRM, not this app: ${offenders.join(', ')}`);
});

test('apiUrl helper derives the mount from window.location', () => {
  const helper = readFileSync(join(fcSrc, 'lib/api-base.ts'), 'utf8');
  assert.match(helper, /export function apiUrl/);
  assert.match(helper, /'\/foreclosure'/, 'the foreclosure mount must be a known prefix');
});
