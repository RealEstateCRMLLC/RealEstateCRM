/*************************************************
 * AgentCore intent parsing regressions
 *
 * 1. "show my pipeline summary" used to match get_contact with
 *    the possessive "my" as a contact name. Possessives are not
 *    names, and summary phrasing routes to summarize_workspace.
 * 2. LLM interpretation is whitelist-only: the model may pick a
 *    read-only executor, never invent actions. (v0.67.17)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectIntent, parseInterpretedIntent } from '../src/lib/agentcore/intents.ts';

test('possessive "my" is not a contact name; summary routes to summarize', () => {
  assert.equal(detectIntent('show my pipeline summary')?.intent, 'summarize_workspace');
  assert.equal(detectIntent('summarize my workspace')?.intent, 'summarize_workspace');
  assert.equal(detectIntent('show contact John details')?.intent, 'get_contact');
  assert.equal(detectIntent('list contacts')?.intent, 'list_contacts');
});

test('interpreted intents are whitelist-parsed with params lifted', () => {
  const hot = parseInterpretedIntent('{"intent":"count_hot_leads","params":{}}');
  assert.equal(hot?.intent, 'count_hot_leads');

  const leads = parseInterpretedIntent('{"intent":"list_leads","status":"HOT"}');
  assert.equal(leads?.intent, 'list_leads');
  assert.equal(leads?.params['status'], 'HOT');

  const contact = parseInterpretedIntent('{"intent":"get_contact","name":"Jane"}');
  assert.equal(contact?.params['id'], 'Jane');

  const evil = parseInterpretedIntent('{"intent":"delete_everything","params":{}}');
  assert.equal(evil?.intent, 'unknown', 'non-whitelisted intents degrade to unknown');

  assert.equal(parseInterpretedIntent('not json at all'), null);
  assert.equal(parseInterpretedIntent(null), null);
});
