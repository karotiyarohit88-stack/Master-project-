import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRegisteredAgentTaskTypes,
  isAgentWorkerStopping,
  requestAgentWorkerStop,
  runAgentTaskWorker
} from '../agentTaskWorkerRuntime.ts';

test('background worker remains disabled unless explicitly enabled', async () => {
  const previous = process.env.MASTER_PROJECT_WORKER_ENABLED;
  delete process.env.MASTER_PROJECT_WORKER_ENABLED;
  try {
    await assert.rejects(
      () => runAgentTaskWorker(),
      /Agent worker is disabled/
    );
  } finally {
    if (previous === undefined) delete process.env.MASTER_PROJECT_WORKER_ENABLED;
    else process.env.MASTER_PROJECT_WORKER_ENABLED = previous;
  }
});

test('enabled worker refuses startup when no reviewed task handlers are registered', async () => {
  const previous = process.env.MASTER_PROJECT_WORKER_ENABLED;
  process.env.MASTER_PROJECT_WORKER_ENABLED = 'true';
  try {
    assert.deepEqual(getRegisteredAgentTaskTypes(), []);
    await assert.rejects(
      () => runAgentTaskWorker(),
      /no registered task handlers/
    );
  } finally {
    if (previous === undefined) delete process.env.MASTER_PROJECT_WORKER_ENABLED;
    else process.env.MASTER_PROJECT_WORKER_ENABLED = previous;
  }
});


test('shutdown request is retained as a worker stop signal', () => {
  requestAgentWorkerStop();
  assert.equal(isAgentWorkerStopping(), true);
});
