import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  RefreshCw, 
  Filter, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Compass, 
  Share2,
  Clock
} from 'lucide-react';
import { AuditLogEntry } from '../types';

export const AutomationLogsCenter: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/audit/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.warn('Failed to load audit logs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'security') return log.category === 'security' || log.category === 'approval';
    if (filter === 'webhook') return log.category === 'webhook';
    if (filter === 'autopilot') return log.category === 'autopilot';
    if (filter === 'video') return log.category === 'video';
    if (filter === 'chat') return log.category === 'chat';
    return true;
  });

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `master_agent_audit_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-5xl w-full mx-auto p-2.5 sm:p-4 overflow-y-auto min-w-0">
      {/* Top Banner */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-2xs mb-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">System Audit & Automation Logs</h2>
              <p className="text-xs text-slate-500 truncate">
                Immutable audit trail for human approvals, webhook executions, safety gates, and rate limits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportJSON}
              className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit Trail</span>
            </button>
            <button
              type="button"
              onClick={fetchLogs}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs transition-colors cursor-pointer"
              title="Refresh logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-100 overflow-x-auto min-w-0">
          {[
            { id: 'all', label: `All Events (${logs.length})` },
            { id: 'security', label: 'Security & Approvals' },
            { id: 'webhook', label: 'Webhooks' },
            { id: 'autopilot', label: 'Auto Pilot' },
            { id: 'video', label: 'Video & Audio' },
            { id: 'chat', label: 'Chat Engine' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex-shrink-0 ${
                filter === tab.id
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden min-w-0">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No audit records found matching filter "{filter}".
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((entry) => (
              <div key={entry.id} className="p-3.5 sm:p-4 hover:bg-slate-50/70 transition-colors space-y-1.5 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      entry.status === 'success' ? 'bg-emerald-500' :
                      entry.status === 'blocked' ? 'bg-rose-500' :
                      entry.status === 'warning' ? 'bg-amber-500' :
                      'bg-blue-500'
                    }`} />
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {entry.action}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-semibold flex-shrink-0">
                      {entry.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono flex-shrink-0">
                    <Clock className="w-3 h-3 text-slate-300" />
                    <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    {entry.executionHash && (
                      <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-100">
                        {entry.executionHash}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 pl-4 break-words leading-relaxed">
                  {entry.details}
                </p>

                {entry.ip && (
                  <p className="text-[10px] text-slate-400 pl-4 font-mono">
                    Client IP: {entry.ip}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
