/*************************************************
 * find_tools discovery ranking (tool-drop routing seed)
 *
 * Local tools rank by keyword overlap; voice/MLS queries must
 * also surface the LeadCaller sibling pointer, pipeline queries
 * the aicrm sibling. (Phase 18, v0.67.18)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankTools, matchSiblings } from '../src/lib/mcp/tool-catalog.ts';

const TOOLS = [
  { name: 'list_contacts', description: 'List contacts. Supports search and filtering.' },
  { name: 'create_task', description: 'Create a follow-up task.' },
  { name: 'summarize_workspace', description: 'Get workspace summary statistics.' },
];

test('rankTools surfaces the obvious local tool first', () => {
  const ranked = rankTools('create a follow-up task', TOOLS);
  assert.equal(ranked[0]?.tool.name, 'create_task');
  assert.equal(rankTools('zzzz nothing', TOOLS).length, 0);
});

test('voice and pipeline queries match the right sibling servers', () => {
  assert.equal(matchSiblings('call a lead')[0]?.server, 'leadcaller');
  assert.equal(matchSiblings('move a lead stage in the pipeline')[0]?.server, 'aicrm');
  assert.equal(matchSiblings('unrelated banana').length, 0);
});
