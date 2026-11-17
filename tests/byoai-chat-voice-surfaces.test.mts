/*************************************************
 * BYO-AI dashboard surfaces (v0.67.21)
 *
 * Two regressions this pins:
 * 1. /api/chat (the dashboard AI chat) was hardwired to DeepSeek via
 *    getDeepSeekModel(), ignoring the Settings provider switch that
 *    every other call site honors. It must resolve its model through
 *    getActiveChatModel() and only fall back to DeepSeek when the
 *    active provider cannot stream (Anthropic) or is unset.
 * 2. /api/agentcore/voice-command returned lead names AND phone
 *    numbers to anyone who POSTed a workspaceId - no session check at
 *    all. It must resolve workspace/user from the authenticated
 *    session (requireWorkspaceAccess) and never trust body fields.
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chat = readFileSync(join(root, 'src/app/api/chat/route.ts'), 'utf8');
const voice = readFileSync(join(root, 'src/app/api/agentcore/voice-command/route.ts'), 'utf8');
const resolver = readFileSync(join(root, 'src/lib/ai/active-provider.ts'), 'utf8');

test('dashboard chat resolves its model through the active provider', () => {
  assert.match(chat, /getActiveChatEndpoint\(\)/, 'chat route must use the provider-switch resolver');
  assert.match(resolver, /export async function getActiveChatEndpoint/, 'resolver must expose the active chat endpoint');
  for (const provider of ['openai', 'deepseek', 'qwen', 'gemini']) {
    assert.match(resolver, new RegExp(`${provider}:`), `chat endpoint must cover ${provider}`);
  }
  assert.doesNotMatch(chat, /from 'ai'/, 'chat must not depend on the version-skewed AI SDK streaming path');
  assert.doesNotMatch(chat, /getDeepSeekModel/, 'chat must not be hardwired to DeepSeek');
});

test('contentplanner login page only offers configured providers', () => {
  const login = readFileSync(
    join(root, 'apps/contentplanner/apps/web/src/app/login/page.tsx'),
    'utf8',
  );
  assert.match(login, /api\/auth\/providers/, 'login page must check which providers the server configured');
  assert.match(login, /githubConfigured/, 'GitHub button must be gated on the github provider existing');
  assert.doesNotMatch(
    login,
    /callbackUrl: '\/dashboard'/,
    'callbackUrl must keep the /contentplanner mount prefix, not bounce to the main CRM dashboard',
  );
});

test('settings reports key health and refuses to activate an unreadable key', () => {
  const route = readFileSync(join(root, 'src/app/api/ai/provider-setting/route.ts'), 'utf8');
  const client = readFileSync(join(root, 'src/components/AIModelsSettingsClient.tsx'), 'utf8');
  assert.match(route, /keyHealth/, 'GET must report per-provider key health');
  assert.match(route, /health\[provider\] === 'unreadable'/, 'POST must refuse to activate an undecryptable key');
  assert.match(route, /Re-save its key/, 'refusal must tell the operator how to fix it');
  assert.match(client, /key unreadable/, 'the provider select must label an unreadable key honestly');
  assert.match(route, /maxTokens: 512/, 'the connectivity probe needs budget for reasoning models');
  assert.match(route, /did not return the expected marker/, 'the probe must verify the marker, not just any reply');
  assert.doesNotMatch(route, /key: row\.key|apiKey: .*\.key/, 'key material must never be serialized');
});

test('undecryptable selected key is an error, never a silent downgrade', () => {
  assert.match(resolver, /reason: 'no-key'/, 'resolver must distinguish a broken selected key from unconfigured');
  assert.match(chat, /resolved\.reason === 'no-key'/, 'chat must surface the broken-key state');
  assert.match(chat, /Re-save the key/, 'error must tell the user how to fix it');
  assert.match(resolver, /could not be decrypted/, 'vault decrypt failures must be logged, not swallowed');
});

test('chat route executes tools in a bounded loop', () => {
  assert.match(chat, /round < 3/, 'tool loop must be bounded so a model cannot loop spend indefinitely');
  assert.match(chat, /role: 'tool'/, 'tool results must be returned to the model');
  assert.doesNotMatch(chat, /\.toAIStreamResponse\(\)/, 'the SDK stream call that 500d in prod must stay gone');
});

test('voice-command reports win over the generic show/search branch', () => {
  const reportAt = voice.indexOf("lower.includes('report')");
  const searchAt = voice.indexOf("lower.includes('show')");
  assert.ok(reportAt !== -1 && searchAt !== -1 && reportAt < searchAt,
    '"show me the report" must parse as SHOW_REPORT, not SEARCH');
});

test('voice-command requires an authenticated workspace session', () => {
  assert.match(voice, /getServerSession\(authOptions\)/, 'must read the NextAuth session');
  assert.match(voice, /requireWorkspaceAccess\(session\)/, 'workspace must come from the session, not the request body');
  assert.doesNotMatch(
    voice,
    /const \{ command, workspaceId, userId \} = body/,
    'caller-supplied workspaceId/userId must never be trusted',
  );
  assert.doesNotMatch(voice, /body\.workspaceId|body\.userId/, 'body workspace/user fields must not be read at all');
});
