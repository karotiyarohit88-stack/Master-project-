import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';

type QueueTask = {
  id: string;
  task_type: string;
  original_prompt: string;
  status: string;
  requires_approval: boolean;
  approved_at: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
  canCancel: boolean;
};

type QueueEvent = { id: number; event_type: string; message: string; created_at: string };
type QueueResult = { file: string; content: string; truncated: boolean; sourceBytes: number };

const TASK_TYPES = [
  { value: 'read_only', label: 'Read project status (read-only)' },
  { value: 'user_request', label: 'General task' },
  { value: 'code_change', label: 'Code change' },
  { value: 'automation', label: 'Automation' },
  { value: 'media_generation', label: 'Media generation' },
  { value: 'integration', label: 'Integration' }
];

export const DurableTaskQueuePanel: React.FC<{ refreshToken?: number }> = ({ refreshToken = 0 }) => {
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [tenantRole, setTenantRole] = useState<string>('');
  const [taskType, setTaskType] = useState('user_request');
  const [prompt, setPrompt] = useState('');
  const [events, setEvents] = useState<Record<string, QueueEvent[]>>({});
  const [results, setResults] = useState<Record<string, QueueResult>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workingTask, setWorkingTask] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tasks?limit=50', { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Durable task queue is unavailable.');
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      setTenantRole(typeof data.tenantRole === 'string' ? data.tenantRole : '');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Durable task queue is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh, refreshToken]);

  const submitTask = async () => {
    if (!prompt.trim() || submitting) return;
    setSubmitting(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          taskType,
          prompt: prompt.trim(),
          ...(taskType === 'read_only' ? { payload: { action: 'read_project_status' } } : {})
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Task could not be saved.');
      setPrompt('');
      setNotice('Task durable queue में save हुआ है और Human Approval की प्रतीक्षा कर रहा है। Worker execution अभी शुरू नहीं हुआ है।');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task could not be saved.');
    } finally { setSubmitting(false); }
  };

  const actOnTask = async (taskId: string, action: 'approve' | 'reject' | 'cancel') => {
    setWorkingTask(taskId); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/tasks/${taskId}/${action}`, {
        method: 'POST', credentials: 'same-origin'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Task update was rejected.');
      setNotice(action === 'approve'
        ? 'Human approval record हो गया। Task queue में है; Worker ने अभी execution शुरू नहीं किया।'
        : action === 'reject'
          ? 'Task अस्वीकार कर दिया गया। कोई Worker execution शुरू नहीं हुआ।'
          : 'Task cancel कर दिया गया।');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task update was rejected.');
    } finally { setWorkingTask(null); }
  };

  const toggleEvents = async (taskId: string) => {
    if (events[taskId]) {
      setEvents(current => { const next = { ...current }; delete next[taskId]; return next; });
      return;
    }
    try {
      const response = await fetch(`/api/tasks/${taskId}/events`, { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Task activity is unavailable.');
      setEvents(current => ({ ...current, [taskId]: Array.isArray(data.events) ? data.events : [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task activity is unavailable.');
    }
  };

  const toggleResult = async (taskId: string) => {
    if (results[taskId]) {
      setResults(current => { const next = { ...current }; delete next[taskId]; return next; });
      return;
    }
    try {
      const response = await fetch(`/api/tasks/${taskId}/result`, { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Task result is unavailable.');
      if (!data.result || typeof data.result.content !== 'string') throw new Error('Task result format is invalid.');
      setResults(current => ({ ...current, [taskId]: data.result as QueueResult }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task result is unavailable.');
    }
  };

  const canApprove = tenantRole === 'owner' || tenantRole === 'admin';

  return (
    <section className="mt-5 bg-white border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-700" /> Durable Agent Task Queue
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">Tenant-scoped PostgreSQL task history · Human approval required before queueing</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50" title="Refresh tasks">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
        <label className="block text-xs font-semibold text-slate-800" htmlFor="durable-task-type">Task category</label>
        <select id="durable-task-type" value={taskType} onChange={e => setTaskType(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800">
          {TASK_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <label className="block text-xs font-semibold text-slate-800" htmlFor="durable-task-prompt">What should the agent work on?</label>
        <textarea id="durable-task-prompt" value={prompt} onChange={e => setPrompt(e.target.value)}
          maxLength={12000} rows={3} placeholder="Describe the task. Do not paste passwords or API keys."
          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500">All tasks wait for Owner/Admin approval. Read-only currently reads PROJECT_STATUS.md only.</span>
          <button type="button" onClick={() => void submitTask()} disabled={submitting || !prompt.trim()}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 flex items-center gap-1.5">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Save for approval
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{notice}</div>}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">Recent tasks ({tasks.length})</h4>
          {loading && <span className="text-[10px] text-slate-500">Loading…</span>}
        </div>
        {tasks.length === 0 && !loading ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
            No durable tasks found in this workspace yet.
          </div>
        ) : tasks.map(task => (
          <article key={task.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 break-words">{task.original_prompt}</p>
                <p className="text-[10px] text-slate-500 mt-1">{task.task_type.replaceAll('_', ' ')} · {new Date(task.created_at).toLocaleString()}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${
                task.status === 'waiting_approval' ? 'border-amber-300 bg-amber-50 text-amber-800' :
                task.status === 'completed' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' :
                task.status === 'failed' || task.status === 'rejected' ? 'border-rose-300 bg-rose-50 text-rose-800' :
                'border-slate-200 bg-slate-50 text-slate-700'
              }`}>{task.status.replaceAll('_', ' ')}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">Attempt {task.attempts}/{task.max_attempts} · {task.requires_approval ? 'Approval gated' : 'No approval gate'}</span>
              <div className="flex flex-wrap gap-1.5">
                {canApprove && task.status === 'waiting_approval' && (
                  <button type="button" disabled={workingTask === task.id} onClick={() => void actOnTask(task.id, 'approve')}
                    className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50">
                    Approve
                  </button>
                )}
                {canApprove && task.status === 'waiting_approval' && (
                  <button type="button" disabled={workingTask === task.id} onClick={() => void actOnTask(task.id, 'reject')}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-semibold text-rose-800 disabled:opacity-50">
                    Reject
                  </button>
                )}
                {task.canCancel && ['waiting_approval', 'queued', 'retry_wait'].includes(task.status) && (
                  <button type="button" disabled={workingTask === task.id} onClick={() => void actOnTask(task.id, 'cancel')}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 disabled:opacity-50">
                    Cancel
                  </button>
                )}
                <button type="button" onClick={() => void toggleEvents(task.id)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 flex items-center gap-1">
                  <Clock3 className="w-3 h-3" /> Activity
                </button>
                {task.task_type === 'read_only' && task.status === 'completed' && (
                  <button type="button" onClick={() => void toggleResult(task.id)}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-800">
                    {results[task.id] ? 'Hide result' : 'View result'}
                  </button>
                )}
              </div>
            </div>
            {events[task.id] && (
              <div className="border-t border-slate-100 pt-2 space-y-1">
                {events[task.id].map(event => (
                  <div key={event.id} className="flex gap-2 text-[10px] text-slate-600">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="min-w-0 break-words">{event.message} <span className="text-slate-400">· {new Date(event.created_at).toLocaleString()}</span></span>
                  </div>
                ))}
              </div>
            )}
            {results[task.id] && (
              <div className="border-t border-slate-100 pt-2 space-y-2">
                <p className="text-[10px] font-semibold text-emerald-800">{results[task.id].file} · {results[task.id].sourceBytes} bytes{results[task.id].truncated ? ' · preview truncated' : ''}</p>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-700">{results[task.id].content}</pre>
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="text-[10px] text-slate-500">Approval only queues a task. Actual AI/worker execution is not active until the background worker and approved task handlers are deployed.</p>
    </section>
  );
};
