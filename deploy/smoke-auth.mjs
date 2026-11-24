/**
 * Cross-app auth smoke gate (node deploy/smoke-auth.mjs)
 *
 * The roasts were right about one systemic thing: auth was verified
 * app-by-app, ad hoc, and two apps shipped with logins that posted
 * credentials to the wrong application. This gate checks, for every
 * mounted app, from the outside:
 *   1. an unauthenticated API write is refused (401, never 2xx), and
 *   2. the designated test identity can establish a real session.
 * Credentials come from local Temp files (never committed):
 *   prod-admin-pw.txt + prod-admin-email.txt (main break-glass),
 *   subtest-pw.txt (loop-test@ for the sub-apps).
 * Exit code 0 only when every check passes.
 */
import fs from 'node:fs';

const ORIGIN = 'https://excellegacyrealtygroup.site';
const TEMP = process.env.TEMP || '';
const read = (name) => fs.readFileSync(`${TEMP}\\${name}`, 'utf8').trim();
const adminEmail = read('prod-admin-email.txt');
const adminPw = read('prod-admin-pw.txt');
const subPw = read('subtest-pw.txt');
const SUB_USER = 'loop-test@excellegacyrealtygroup.site';

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

function jarOf() {
  const jar = new Map();
  return {
    store(res) {
      const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      for (const c of sc) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i).trim(), kv.slice(i + 1)); }
    },
    header() { return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '); },
  };
}

async function nextAuthLogin(base, field, identifier, password) {
  const jar = jarOf();
  let r = await fetch(`${base}/api/auth/csrf`);
  jar.store(r);
  if (!r.ok) return { ok: false, stage: `csrf ${r.status}` };
  const { csrfToken } = await r.json();
  const body = new URLSearchParams({ csrfToken, password, json: 'true' });
  body.set(field, identifier);
  r = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
    body,
  });
  jar.store(r);
  const sessionRes = await fetch(`${base}/api/auth/session`, { headers: { Cookie: jar.header() } });
  const session = await sessionRes.json().catch(() => null);
  return { ok: !!session?.user, stage: `callback ${r.status}`, session };
}

// 1. Unauthenticated writes must be refused everywhere.
const unauthWrites = [
  ['main leads', '/api/leads', { firstName: 'Smoke' }],
  ['main approvals', '/api/approvals', { title: 'smoke' }],
  ['main mcp', '/api/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }],
  ['aicrm mcp', '/aicrm/api/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }],
  ['foreclosure leads', '/foreclosure/api/leads', { ownerName: 'Smoke' }],
];
for (const [label, path, payload] of unauthWrites) {
  const r = await fetch(ORIGIN + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  check(`unauth ${label}`, r.status === 401, `got ${r.status}`);
}
// LeadCaller MCP is SSE: a bare GET without auth must 401.
{
  const r = await fetch(ORIGIN + '/leadcaller/api/mcp', { headers: { Accept: 'text/event-stream' } });
  if (r.body) r.body.cancel().catch(() => {});
  check('unauth leadcaller mcp (SSE)', r.status === 401, `got ${r.status}`);
}

// 1b. The Nov-2026 batch: internal data GETs must refuse anonymous
// callers (they served lead names, staff emails, server paths, API
// keys, audit trails). Public-by-design exceptions are asserted
// separately below.
const unauthGets = [
  'scoring', 'gamification', 'reporting', 'data-quality', 'folder-detection',
  'audit', 'voice-settings', 'objections', 'offers', 'partners', 'referrals',
  'search-alerts', 'partner-permissions', 'websites', 'client-portal', 'uploads',
];
for (const name of unauthGets) {
  const r = await fetch(`${ORIGIN}/api/${name}`);
  check(`unauth GET ${name}`, r.status === 401, `got ${r.status}`);
}
// Public by design: listing feeds + anonymized syndication + the
// token-based client portal branch (invalid token -> 404, not data).
for (const [label, path, expect] of [
  ['listings public', '/api/listings', 200],
  ['idx public', '/api/idx', 200],
  ['syndication public (anonymized)', '/api/syndication', 200],
  ['client-portal invalid token 404', '/api/client-portal?token=smoke-invalid-token', 404],
]) {
  const r = await fetch(ORIGIN + path);
  check(label, r.status === expect, `got ${r.status}`);
}

// 2. Test identities can establish sessions.
{
  const main = await nextAuthLogin(ORIGIN, 'email', adminEmail, adminPw);
  check('main break-glass session', main.ok, main.stage);
}
for (const [label, base, field] of [
  ['aicrm', '/aicrm', 'email'],
  ['leadcaller', '/leadcaller', 'email'],
  ['leadg', '/leadg', 'email'],
  ['foreclosure', '/foreclosure', 'username'],
]) {
  // aicrm uses its own login endpoint shape; handle it separately below.
  if (label === 'aicrm') continue;
  const res = await nextAuthLogin(ORIGIN + base, field, SUB_USER, subPw);
  check(`${label} loop-test session`, res.ok, res.stage);
}
{
  const jar = jarOf();
  const r = await fetch(ORIGIN + '/aicrm/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SUB_USER, password: subPw }),
  });
  jar.store(r);
  const me = await fetch(ORIGIN + '/aicrm/api/auth/me', { headers: { Cookie: jar.header() } }).catch(() => null);
  check('aicrm loop-test session', r.status === 200, `login ${r.status}${me ? ', me ' + me.status : ''}`);
}
// ContentPlanner has no working login by design (owner decision pending);
// its providers endpoint must answer and must NOT offer a dead GitHub flow.
{
  const r = await fetch(ORIGIN + '/contentplanner/api/auth/providers');
  const providers = await r.json().catch(() => ({}));
  check('contentplanner providers honest', r.status === 200 && !('github' in providers), `status ${r.status}, providers: ${Object.keys(providers).join(',') || 'none'}`);
}

console.log(failures === 0 ? 'SMOKE AUTH: ALL PASSED' : `SMOKE AUTH: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
