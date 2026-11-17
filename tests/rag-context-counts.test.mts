/*************************************************
 * RAG chat context counts must be live totals (v0.67.22)
 *
 * buildChatContext sampled leads/contacts/deals/activities with
 * take 8/8/6/12 and then reported the SAMPLE lengths as the counts
 * ("leads=8" when the workspace had 17). The chat model quoted the
 * fake total until a real tool call contradicted it. The Counts line
 * must come from COUNT queries, and the recent lists must be labeled
 * as the samples they are.
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rag = readFileSync(join(root, 'src/lib/rag.ts'), 'utf8');

test('workflows sidebar assistant runs real commands, never simulated replies', () => {
  const sidebar = readFileSync(join(root, 'src/components/SidebarAIAssistant.tsx'), 'utf8');
  assert.match(sidebar, /fetch\('\/api\/agentcore'/, 'sidebar must call the real AgentCore endpoint');
  assert.doesNotMatch(sidebar, /Simulate AI response/, 'the canned-reply simulation must stay gone');
  assert.doesNotMatch(sidebar, /Gemini CRM Assistant|Gemini AI/, 'provider-specific branding must stay gone (provider is switchable)');
  const chatWidget = readFileSync(join(root, 'src/components/AIChat.tsx'), 'utf8');
  assert.doesNotMatch(chatWidget, /Gemini AI Command Center|I am Gemini/, 'chat widget branding must stay provider-neutral');
});

test('context counts come from COUNT queries, not sample lengths', () => {
  for (const model of ['lead', 'contact', 'deal', 'activity']) {
    assert.match(
      rag,
      new RegExp(`prisma\\.${model}\\.count\\(\\{ where: \\{ workspaceId: workspaceSlug \\} \\}\\)`),
      `${model} total must be a real COUNT query`,
    );
  }
  assert.doesNotMatch(
    rag,
    /Counts: leads=\$\{leads\.length\}/,
    'the old sample-length Counts line must stay gone',
  );
  assert.match(rag, /Counts \(live totals\)/, 'counts line must be labeled as live totals');
  assert.match(rag, /sample of \$\{leads\.length\} of \$\{leadCount\}/, 'recent lists must be labeled as samples');
});
