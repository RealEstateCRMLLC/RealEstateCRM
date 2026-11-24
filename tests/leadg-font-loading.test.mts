/*************************************************
 * LeadG must self-host its fonts (v0.67.27)
 *
 * The layout loaded Syne/DM Mono from fonts.googleapis.com at
 * runtime. That stylesheet took ~11s in the browser, and a pending
 * stylesheet blocks every script on the page: LeadG rendered but
 * never hydrated for ~15s, so its forms submitted NATIVELY (login
 * and lead-create data went out as GET query strings) and every
 * interactive control was dead. Fonts now come from next/font
 * (build-time download, served from our own origin).
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(root, 'apps/leadg/src/app/layout.tsx'), 'utf8');
const css = readFileSync(join(root, 'apps/leadg/src/app/globals.css'), 'utf8');

test('leadg layout self-hosts fonts via next/font, never the Google CDN', () => {
  assert.match(layout, /from 'next\/font\/google'/, 'fonts must be build-time self-hosted');
  assert.doesNotMatch(layout, /href="https:\/\/fonts\.googleapis\.com|fonts\.googleapis\.com\/css/, 'no runtime Google Fonts stylesheet may come back');
  assert.match(css, /var\(--font-syne\)/, 'CSS variables must consume the next/font variables');
  assert.match(css, /var\(--font-dm-mono\)/, 'CSS variables must consume the next/font variables');
});
