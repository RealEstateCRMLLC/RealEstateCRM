/*************************************************
 * LeadG lead detail must not use Next 15 params form (v0.67.27)
 *
 * LeadG runs Next 14, where page params is a plain object. The
 * detail page called React use(params) (the Next 15 Promise form),
 * which throws React error #438 and crashed the page for every
 * lead. It also fetched its API root-absolute (template literals),
 * which resolves to the main CRM under the /leadg mount.
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lgSrc = join(root, 'apps/leadg/src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

test('no LeadG client code calls React use() on route params', () => {
  const offenders: string[] = [];
  for (const file of walk(lgSrc)) {
    const src = readFileSync(file, 'utf8');
    if (/\buse\(\s*params\s*\)/.test(src)) offenders.push(file.replace(lgSrc, ''));
  }
  assert.deepEqual(offenders, [], `use(params) crashes on Next 14: ${offenders.join(', ')}`);
});

test('no LeadG client file fetches a root-absolute /api path (any quote form)', () => {
  const offenders: string[] = [];
  for (const file of walk(lgSrc)) {
    if (file.endsWith('api-base.ts')) continue;
    const src = readFileSync(file, 'utf8');
    if (/fetch\(\s*["'`]\/api\//.test(src)) offenders.push(file.replace(lgSrc, ''));
  }
  assert.deepEqual(offenders, [], `root-absolute fetches hit the main CRM: ${offenders.join(', ')}`);
});
