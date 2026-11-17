/*************************************************
 * Regression: Team Chat "New Chat" must pick participants
 *
 * The create form hardcoded participantIds: [] and had no user
 * picker at all, so every Create click POSTed an empty list and
 * the API correctly 400'd ("participantIds required") - silently,
 * with no feedback. The form must load workspace members from
 * /api/team, let the user select participants, send those IDs,
 * and block creation with none selected. (v0.67.9)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/components/TeamChat.tsx'), 'utf8');

test('team chat loads members and sends selected participantIds', () => {
  assert.match(src, /fetch\(['"]\/api\/team['"]\)/, 'must load workspace members from /api/team');
  assert.doesNotMatch(src, /participantIds:\s*\[\]/, 'must not hardcode an empty participant list');
  assert.match(src, /selectedIds/, 'must track selected participant IDs');
  assert.match(src, /disabled=\{selectedIds\.length === 0/, 'Create must be disabled until someone is selected');
});
