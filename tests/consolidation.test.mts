/*************************************************
 * Consolidation + LeadG middleware regressions
 *
 * 1. Settings subpages (/dashboard/settings/<tab>) were standalone
 *    duplicates of the inline SettingsTabs panels. They now redirect
 *    to /dashboard/settings?tab=<tab> (same pattern as the earlier
 *    reporting/analytics merge).
 * 2. LeadG used next-auth withAuth, which never intercepts in this
 *    stack: logged-out /leadg/dashboard hung on "Loading...". Its
 *    middleware must be the hand-written getToken guard with a
 *    mount-aware sign-in redirect. (v0.67.8)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const SETTINGS_TABS = ['ai-memory', 'ai-models', 'branding', 'email', 'integrations', 'mcp', 'team', 'voice'];

for (const tab of SETTINGS_TABS) {
  test(`settings/${tab} redirects into the consolidated settings page`, () => {
    const src = read(`src/app/dashboard/settings/${tab}/page.tsx`);
    assert.match(src, /redirect\(/, 'subpage must redirect, not render a duplicate panel');
    assert.match(src, new RegExp(`/dashboard/settings\\?tab=${tab}`), `must target ?tab=${tab}`);
  });
}

test('SettingsTabs never imports panels from route files (redirect stubs crash tabs)', () => {
  const src = read('src/components/dashboard/SettingsTabs.tsx');
  assert.doesNotMatch(
    src,
    /from '@\/app\/dashboard\/settings\//,
    'tabs must import shared components (src/components/settings/*), not page routes - a redirect stub rendered as a tab throws React #310',
  );
});

test('leadg middleware is a getToken guard with mount-aware login redirect', () => {
  const src = read('apps/leadg/src/middleware.ts');
  assert.doesNotMatch(src, /next-auth\/middleware|withAuth\(\{/, 'withAuth is inert in this stack and must not be used');
  assert.match(src, /getToken/, 'must verify the session token explicitly');
  assert.match(src, /basePath[^)]*\/login/, 'sign-in redirect must keep the /leadg mount prefix');
});
