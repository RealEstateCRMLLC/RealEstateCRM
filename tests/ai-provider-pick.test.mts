/*************************************************
 * Plug-and-play provider choice semantics.
 *
 * pickProvider decides which LLM every CRM feature uses:
 * explicit Settings choice wins (when its key exists), then the
 * platform DeepSeek env key, then any vault key in
 * deepseek/openai/anthropic/gemini/qwen order, else none (callers
 * use deterministic fallbacks). (v0.67.10)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickProvider } from '../src/lib/ai/provider-settings.ts';

const setting = (provider: string, model = '') => ({ provider, model, updatedAt: '2026-11-17T00:00:00.000Z' });

test('explicit setting wins when its key is configured', () => {
  const pick = pickProvider(setting('anthropic', 'claude-x'), ['openai', 'anthropic'], {});
  assert.equal(pick.provider, 'anthropic');
  assert.equal(pick.model, 'claude-x');
  assert.equal(pick.source, 'setting');
});

test('setting without a key falls through to env DeepSeek', () => {
  const pick = pickProvider(setting('gemini'), ['openai'], { DEEPSEEK_API_KEY: 'sk-env' });
  assert.equal(pick.provider, 'deepseek');
  assert.equal(pick.source, 'env');
});

test('vault preference order without setting or env', () => {
  assert.equal(pickProvider(null, ['qwen', 'anthropic'], {}).provider, 'anthropic');
  assert.equal(pickProvider(null, ['qwen', 'openai'], {}).provider, 'openai');
  assert.equal(pickProvider(null, [], {}).source, 'none');
});

test('blank model in setting resolves to the provider default', () => {
  const pick = pickProvider(setting('openai'), ['openai'], {});
  assert.equal(pick.model, 'gpt-4o-mini');
});
