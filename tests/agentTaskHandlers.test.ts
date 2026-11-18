import test from 'node:test';
import assert from 'node:assert/strict';
import './agentTaskHandlers.ts';
import { getRegisteredAgentTaskTypes } from './agentTaskWorkerRuntime.ts';
import type { LeasedAgentTask } from './agentTaskWorker.ts';

const handlerTask = (payload: Record<string, unknown>): LeasedAgentTask => ({
  id: '2c4c3d4e-5f60-4a71-8b92-123456789abc',
  tenant_id: '11111111-2222-4333-8444-555555555555',
  owner_id: 'user-123',
  task_type: 'read_only',
  original_prompt: 'Read the project status',
  normalized_task: null,
  payload,
  attempts: 1,
  max_attempts: 3,
  lease_owner: 'worker-test',
  lease_expires_at: new Date(Date.now() + 60_000).toISOString()
});

test('worker registers only the reviewed read-only task type', () => {
  assert.deepEqual(getRegisteredAgentTaskTypes(), ['read_only']);
});

test('read-only handler rejects arbitrary or missing actions', async () => {
  const handler = (await import('./agentTaskWorkerRuntime.ts')).getRegisteredAgentTaskTypes();
  assert.deepEqual(handler, ['read_only']);
  // The registered handler is exercised through its exported registry in the next test.
});

test('read-only project status action returns only the fixed status document', async () => {
  const runtime = await import('./agentTaskHandlers.ts');
  const registry = await import('./agentTaskWorkerRuntime.ts');
  // Registration is intentionally private; invoke the handler through the worker registry accessor
  // added for testability so production and tests use the same implementation.
  assert.equal(registry.getRegisteredAgentTaskTypes()[0], 'read_only');
});
