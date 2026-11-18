import {
  claimNextAgentTask,
  completeLeasedAgentTask,
  createAgentWorkerId,
  failLeasedAgentTask,
  renewAgentTaskLease,
  type LeasedAgentTask
} from './agentTaskWorker.ts';
import { getPostgresMigrationStatus } from './database.ts';

export type AgentTaskHandler = (
  task: LeasedAgentTask,
  context: { signal: AbortSignal; workerId: string }
) => Promise<Record<string, unknown>>;

const handlers = new Map<string, AgentTaskHandler>();
let stopping = false;

export function registerAgentTaskHandler(taskType: string, handler: AgentTaskHandler): void {
  if (!/^[a-z][a-z0-9_:-]{0,63}$/.test(taskType) || typeof handler !== 'function') {
    throw new Error('Invalid agent task handler registration.');
  }
  if (handlers.has(taskType)) throw new Error('A handler is already registered for this task type.');
  handlers.set(taskType, handler);
}

export function getRegisteredAgentTaskTypes(): string[] {
  return [...handlers.keys()];
}

export function requestAgentWorkerStop(): void {
  stopping = true;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function assertWorkerDatabaseReady(): Promise<void> {
  const status = await getPostgresMigrationStatus();
  const required = [
    '20261114_001_agent_task_queue.sql',
    '20261118_001_tenant_identity.sql',
    '20261118_003_agent_task_tenant_scope.sql'
  ];
  if (!status.migrationTableExists || required.some(version => !status.appliedMigrations.includes(version))) {
    throw new Error('Agent worker is blocked: required tenant/task migrations are not confirmed as applied.');
  }
}

async function executeOne(workerId: string, taskTypes: string[]): Promise<boolean> {
  const task = await claimNextAgentTask(workerId, { taskTypes, leaseSeconds: 120 });
  if (!task) return false;

  const handler = handlers.get(task.task_type);
  if (!handler) {
    // Defensive: claim SQL already limits types; do not run unknown task payloads.
    await failLeasedAgentTask({
      taskId: task.id, tenantId: task.tenant_id, workerId, errorCode: 'HANDLER_NOT_REGISTERED'
    });
    return true;
  }

  const controller = new AbortController();
  let leaseLost = false;
  let heartbeatBusy = false;
  const heartbeat = setInterval(async () => {
    if (heartbeatBusy || controller.signal.aborted) return;
    heartbeatBusy = true;
    try {
      const renewed = await renewAgentTaskLease({
        taskId: task.id, tenantId: task.tenant_id, workerId, leaseSeconds: 120
      });
      if (!renewed) {
        leaseLost = true;
        controller.abort();
      }
    } catch {
      leaseLost = true;
      controller.abort();
    } finally {
      heartbeatBusy = false;
    }
  }, 30_000);

  try {
    const result = await handler(task, { signal: controller.signal, workerId });
    if (leaseLost || controller.signal.aborted) return true;
    await completeLeasedAgentTask({
      taskId: task.id, tenantId: task.tenant_id, workerId, result
    });
  } catch {
    if (!leaseLost) {
      await failLeasedAgentTask({
        taskId: task.id, tenantId: task.tenant_id, workerId, errorCode: 'HANDLER_EXECUTION_FAILED'
      });
    }
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}

/**
 * Runs only as a separately configured worker process. Disabled by default.
 * No handlers are bundled/enabled by default; integrations must register explicit,
 * reviewed handlers before any task type can be claimed.
 */
export async function runAgentTaskWorker(options: {
  pollIntervalMs?: number;
  shouldStop?: () => boolean;
} = {}): Promise<void> {
  if (process.env.MASTER_PROJECT_WORKER_ENABLED !== 'true') {
    throw new Error('Agent worker is disabled. Set MASTER_PROJECT_WORKER_ENABLED=true only after explicit operational approval.');
  }
  const taskTypes = getRegisteredAgentTaskTypes();
  if (taskTypes.length === 0) {
    throw new Error('Agent worker has no registered task handlers; refusing to start.');
  }
  await assertWorkerDatabaseReady();
  stopping = false;
  const workerId = createAgentWorkerId();
  const pollIntervalMs = Math.min(Math.max(Math.floor(options.pollIntervalMs ?? 3000), 500), 30_000);
  const shouldStop = options.shouldStop ?? (() => stopping);

  while (!shouldStop()) {
    try {
      const processed = await executeOne(workerId, taskTypes);
      if (!processed) await wait(pollIntervalMs);
    } catch {
      // Never log task payloads, provider errors, credentials, or database URLs.
      await wait(Math.min(pollIntervalMs * 2, 30_000));
    }
  }
}
