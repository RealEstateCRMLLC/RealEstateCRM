/*************************************************
 * Internal data APIs require a workspace session (v0.67.29)
 *
 * An external probe found the flagship answering anonymously on a
 * batch of data routes the earlier passes never swept: scoring
 * (lead names), gamification (staff emails), reporting, audit,
 * voice-settings (API keys!), offers/partners/referrals CRUD,
 * uploads (S3 presigning), search-alerts, partner-permissions,
 * folder-detection (server paths + fs scans), data-quality,
 * objections, websites list, client-portal list/create. Every
 * handler in these files must resolve the session access first.
 * Public-by-design exceptions ( NOT in this list ): listings,
 * idx, syndication (anonymized), avatar/canva catalogs,
 * websites?slug (published sites), client-portal?token.
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const GATED = [
  'scoring', 'gamification', 'reporting', 'data-quality', 'folder-detection',
  'audit', 'voice-settings', 'objections', 'offers', 'partners', 'referrals',
  'uploads', 'search-alerts', 'partner-permissions', 'websites', 'client-portal',
];

for (const route of GATED) {
  test(`/api/${route} requires workspace access in every handler`, () => {
    const src = readFileSync(join(root, `src/app/api/${route}/route.ts`), 'utf8');
    assert.match(src, /requireWorkspaceAccess/, 'route must resolve workspace access');
    const handlers = (src.match(/export async function (GET|POST|PUT|PATCH|DELETE)/g) || []).length;
    const guards = (src.match(/await requireAccess\(\)/g) || []).length;
    assert.ok(handlers > 0, 'expected at least one handler');
    // Every handler must guard (the public branches in websites
    // ?slug and client-portal ?token sit before the guard inside the
    // same GET handler, so the count is still one guard per handler).
    assert.ok(guards >= handlers,
      `${route}: ${handlers} handlers but only ${guards} guard calls`);
  });
}
