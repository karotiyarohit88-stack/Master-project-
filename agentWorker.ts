import './agentTaskHandlers.ts';
import { runAgentTaskWorker, requestAgentWorkerStop } from './agentTaskWorkerRuntime.ts';
import { runScheduleWorker, requestScheduleWorkerStop } from './server/schedules.ts';

function stopWorkers() {
  requestAgentWorkerStop();
  requestScheduleWorkerStop();
}
process.once('SIGINT', stopWorkers);
process.once('SIGTERM', stopWorkers);

// The same dedicated worker service runs the durable task consumer and recurring
// schedule dispatcher. Both loops are disabled unless explicitly enabled.
Promise.all([
  runAgentTaskWorker(),
  runScheduleWorker()
]).catch(error => {
  const message = error instanceof Error ? error.message : 'Unknown worker startup error';
  console.error('Agent/schedule worker stopped safely:', message);
  stopWorkers();
  process.exitCode = 1;
});
