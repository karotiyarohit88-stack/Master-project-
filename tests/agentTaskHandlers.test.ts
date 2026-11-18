import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readProjectStatusHandler
} from '../agentTaskHandlers.ts';
import { getRegisteredAgentTaskTypes } from '../agentTaskWorkerRuntime.ts';
import type { LeasedAgentTask } from '../agentTaskWorker.ts';

const makeTask = (payload: Record<string, unknown>, taskType = 'read_only'): LeasedAgentTask => ({
  id: '2c4c3d4e-5f60-4a71-8b92-123456789abc',
  tenant_id: '11111111-2222-4333-8444-555555555555',
  owner_id: 'user-123',
  task_type: taskType,
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

test('read-only handler rejects arbitrary actions and task types', async () => {
  const context = { signal: new AbortController().signal, workerId: 'worker-test' };
  await assert.rejects(
    () => readProjectStatusHandler(makeTask({ action: 'read_any_file' }), context),
    /Unsupported read-only action/
  );
  await assert.rejects(
    () => readProjectStatusHandler(makeTask({ action: 'read_project_status' }, 'code_change'), context),
    /Unsupported read-only action/
  );
});

test('read-only project status action reads only the fixed status document', async () => {
  const result = await readProjectStatusHandler(
    makeTask({ action: 'read_project_status' }),
    { signal: new AbortController().signal, workerId: 'worker-test' }
  );
  assert.equal(result.action, 'read_project_status');
  assert.equal(result.file, 'PROJECT_STATUS.md');
  assert.equal(typeof result.content, 'string');
  assert.match(String(result.content), /Master Project AI Agent/);
  assert.equal(typeof result.truncated, 'boolean');
  assert.ok(Number(result.sourceBytes) > 0);
  assert.ok(Buffer.byteLength(String(result.content), 'utf8') <= 48 * 1024);
});

test('read-only project status action respects cancellation before reading', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => readProjectStatusHandler(
      makeTask({ action: 'read_project_status' }),
      { signal: controller.signal, workerId: 'worker-test' }
    ),
    /Task cancelled/
  );
});
