import React, { useState, useEffect } from 'react';
import { BarChart3, RefreshCw, Cpu, Activity, ShieldCheck, CheckCircle2, AlertCircle, HardDrive, Layers, Server } from 'lucide-react';

export const AnalyticsCenter: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      } else {
        setError(`Analytics endpoint returned HTTP ${res.status}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to connect to analytics endpoint');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full max-w-5xl w-full mx-auto p-2.5 sm:p-4 overflow-y-auto min-w-0">
      {/* Top Banner */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-2xs mb-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">System Data Analytics</h2>
              <p className="text-xs text-slate-500 truncate">
                Real-time execution metrics, tool connectivity, and audit telemetry
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchAnalytics}
            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate">Audit Logs</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
            {analytics?.metrics?.totalAuditLogs ?? 0}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">Recorded Events</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate">AutoPilot Tasks</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
            {analytics?.metrics?.autoPilotTasksCount ?? 0}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">Pipeline Jobs</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate">Video Renders</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
            {analytics?.metrics?.videoJobsCount ?? 0}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">Composition Queue</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate">Worker Agents</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
            {analytics?.metrics?.workerAgentsCount ?? 0}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">Sub-Agents Online</span>
        </div>
      </div>

      {/* Tools Connectivity Telemetry */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600" />
          <span>Connected Tools & Systems Telemetry</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {analytics?.activeTools && Object.entries(analytics.activeTools).map(([tool, status]: [string, any]) => (
            <div key={tool} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-800 capitalize">{tool.replace('_', ' ')}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {String(status)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
