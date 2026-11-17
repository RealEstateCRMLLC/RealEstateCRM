/*************************************************
 * Regression: no <button> rows containing <button> children
 *
 * WebsitesClient's page-history rows were <button> elements wrapping
 * Duplicate/Delete <button>s. Nested buttons are invalid HTML: the
 * parser auto-closes the outer button, the hydrated DOM never
 * matches the server HTML, and React throws #418 on
 * /dashboard/agent-websites. Rows are div[role=button] now. (v0.67.9)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/components/websites/WebsitesClient.tsx'), 'utf8');

test('websites history rows are not buttons (they contain action buttons)', () => {
  assert.doesNotMatch(
    src,
    /<button[^>]*onClick=\{\(\) => handleEditPage/,
    'the page row must not be a <button> - it nests Duplicate/Delete buttons (invalid HTML, hydration #418)',
  );
  assert.match(src, /role="button"/, 'row should keep button semantics via role');
});
