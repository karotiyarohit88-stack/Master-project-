import './agentTaskHandlers.ts';
import { runAgentTaskWorker, requestAgentWorkerStop } from './agentTaskWorkerRuntime.ts';

process.once('SIGINT', requestAgentWorkerStop);
process.once('SIGTERM', requestAgentWorkerStop);

runAgentTaskWorker().catch(error => {
  const message = error instanceof Error ? error.message : 'Unknown worker startup error';
  console.error('Agent worker stopped safely:', message);
  process.exitCode = 1;
});
