/*************************************************
 * Task actions must survive missing form fields (v0.67.24)
 *
 * AddTaskModal renders no dueTime input, so formData.get('dueTime')
 * is null. taskSchema declared dueTime .optional() — which accepts
 * undefined but NOT null — and zod v4 calls that a bare
 * "Invalid input". Every Add Task submit failed validation and no
 * task was ever created (verified live: action returned
 * {"error":"Invalid input"}, DB unchanged). The actions now
 * normalize FormData values to string|undefined first.
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { taskSchema, taskUpdateSchema } from '../src/lib/validations/task.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const actions = readFileSync(join(root, 'src/lib/actions/task.ts'), 'utf8');

test('the trap is real: null dueTime fails, undefined passes', () => {
  const base = { title: 'Call seller', status: 'TODO', workspaceId: 'ws1', dueDate: '' };
  assert.equal(taskSchema.safeParse({ ...base, dueTime: null }).success, false, 'null must fail (this was the bug)');
  assert.equal(taskSchema.safeParse({ ...base, dueTime: undefined }).success, true, 'undefined must pass (the fix)');
  assert.equal(taskSchema.safeParse({ ...base, dueTime: '', assignedToId: '' }).success, true, 'empty strings from rendered-but-blank inputs must pass');
});

test('both task write actions normalize FormData before validating', () => {
  const normalizations = actions.match(/str\(formData\.get\(/g) ?? [];
  assert.ok(normalizations.length >= 8, `expected >=8 normalized fields across add+update, got ${normalizations.length}`);
  assert.match(actions, /export async function addTaskAction/);
  assert.match(actions, /export async function updateTaskAction/);
});

test('update schema has the same null sensitivity, so normalization matters there too', () => {
  const base = { taskId: 't1', title: 'X', status: 'TODO', dueDate: '' };
  assert.equal(taskUpdateSchema.safeParse({ ...base, dueTime: null }).success, false);
  assert.equal(taskUpdateSchema.safeParse({ ...base, dueTime: undefined }).success, true);
});
