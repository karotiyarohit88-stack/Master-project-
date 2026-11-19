import { readFile } from 'node:fs/promises';
import {
  registerAgentTaskHandler,
  type AgentTaskHandler
} from './agentTaskWorkerRuntime.ts';

const MAX_RESULT_BYTES = 48 * 1024;

export const readProjectStatusHandler: AgentTaskHandler = async (task, { signal }) => {
  if (task.task_type !== 'read_only' || task.payload?.action !== 'read_project_status') {
    throw new Error('Unsupported read-only action.');
  }
  if (signal.aborted) throw new Error('Task cancelled.');

  const source = await readFile(new URL('./PROJECT_STATUS.md', import.meta.url), {
    encoding: 'utf8',
    signal
  });
  if (signal.aborted) throw new Error('Task cancelled.');

  const bytes = Buffer.from(source, 'utf8');
  const truncated = bytes.byteLength > MAX_RESULT_BYTES;
  const content = truncated
    ? bytes.subarray(0, MAX_RESULT_BYTES).toString('utf8')
    : source;

  return {
    action: 'read_project_status',
    file: 'PROJECT_STATUS.md',
    content,
    truncated,
    sourceBytes: bytes.byteLength
  };
};

// Only this fixed, read-only action is registered. No arbitrary paths or shell commands.
registerAgentTaskHandler('read_only', readProjectStatusHandler);
