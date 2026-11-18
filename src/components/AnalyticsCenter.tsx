import React, { useState, useEffect } from 'react';
import { getCsrfHeaders } from '../utils/csrf';
import { BarChart3, RefreshCw, Cpu, Activity, ShieldCheck, CheckCircle2, AlertCircle, HardDrive, Layers, Server } from 'lucide-react';

export const AnalyticsCenter: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [platformAnalytics, setPlatformAnalytics] = useState<any>(null);
  const [accounting, setAccounting] = useState<any>(null);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutPurpose, setPayoutPurpose] = useState('');
  const [payoutMessage, setPayoutMessage] = useState('');
  const [payoutBusy, setPayoutBusy] = useState(false);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [res, platformRes, accountingRes, payoutRes] = await Promise.all([fetch('/api/analytics'), fetch('/api/analytics/multi-platform'), fetch('/api/accounting/summary'), fetch('/api/accounting/payout-requests')]);
      if (res.ok) setAnalytics(await res.json()); else setError(`Analytics endpoint returned HTTP ${res.status}`);
      if (platformRes.ok) setPlatformAnalytics(await platformRes.json());
      if (accountingRes.ok) setAccounting(await accountingRes.json());
      if (payoutRes.ok) { const payoutData = await payoutRes.json(); setPayoutRequests(payoutData.requests || []); }
    } catch (e: any) {
      setError(e?.message || 'Failed to connect to analytics endpoint');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const csrfHeaders = () => ({
    'Content-Type': 'application/json',
    ...getCsrfHeaders()
  });

  const createPayoutRequest = async () => {
    setPayoutBusy(true); setPayoutMessage('');
    try {
      const res = await fetch('/api/accounting/payout-requests', { method: 'POST', credentials: 'same-origin', headers: csrfHeaders(), body: JSON.stringify({ amount: Number(payoutAmount), purpose: payoutPurpose }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payout request failed.');
      setPayoutMessage('Request created and staged for Owner approval. No transfer was initiated.'); setPayoutAmount(''); setPayoutPurpose(''); fetchAnalytics();
    } catch (e: any) { setPayoutMessage(e?.message || 'Payout request failed.'); }
    finally { setPayoutBusy(false); }
  };

  const recordOwnerApproval = async (id: string) => {
    setPayoutBusy(true); setPayoutMessage('');
    try {
      const res = await fetch('/api/accounting/payout-requests/' + encodeURIComponent(id) + '/approve', { method: 'POST', credentials: 'same-origin', headers: csrfHeaders(), body: JSON.stringify({ ownerConfirmation: true }) });
      const data = await res.json();
      if (res.status === 423) setPayoutMessage(data.error || 'Transfer blocked by native service verification.');
      else if (!res.ok) throw new Error(data.error || 'Owner approval could not be recorded.');
      fetchAnalytics();
    } catch (e: any) { setPayoutMessage(e?.message || 'Approval could not be recorded.'); }
    finally { setPayoutBusy(false); }
  };

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
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
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

      {/* Multi-Platform Analytics: sourced from actual application records */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs mb-4 space-y-3">
        <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-600" /><h3 className="text-sm font-bold text-slate-900">Multi-Platform Analytics</h3></div>
        <p className="text-[11px] text-slate-500">Counts are derived from recorded publishing posts, AutoPilot tasks and webhook workflow records. No estimated reach or fabricated engagement.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 p-3"><p className="text-xs font-semibold text-slate-700">YouTube</p><p className="text-xl font-bold text-slate-900">{platformAnalytics?.platforms?.youtube?.publishedPosts ?? 0}</p><p className="text-[10px] text-slate-500">Published · {platformAnalytics?.platforms?.youtube?.tasks ?? 0} tasks</p></div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><p className="text-xs font-semibold text-slate-700">Social Media</p><p className="text-xl font-bold text-slate-900">{platformAnalytics?.platforms?.socialMedia?.publishedPosts ?? 0}</p><p className="text-[10px] text-slate-500">Published · {platformAnalytics?.platforms?.socialMedia?.tasks ?? 0} tasks</p></div>
          <div className="rounded-xl bg-amber-50/60 border border-amber-200 p-3"><p className="text-xs font-semibold text-slate-700">Webhooks</p><p className="text-xl font-bold text-slate-900">{platformAnalytics?.platforms?.webhooks?.webhookActions ?? 0}</p><p className="text-[10px] text-slate-500">Recorded webhook actions</p></div>
        </div>
      </section>

      {/* Verified earnings ledger and mandatory payout approval */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs mb-4 space-y-4">
        <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /><h3 className="text-sm font-bold text-slate-900">Earning & GST Account</h3></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><p className="text-[10px] text-slate-500">Total Balance (INR)</p><p className="text-lg font-bold text-slate-900">{Number(accounting?.totalBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p></div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><p className="text-[10px] text-slate-500">Taxable Amount</p><p className="text-lg font-bold text-slate-900">{Number(accounting?.taxableAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p></div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><p className="text-[10px] text-slate-500">CGST / SGST</p><p className="text-sm font-bold text-slate-900">{Number(accounting?.cgst || 0).toFixed(2)} / {Number(accounting?.sgst || 0).toFixed(2)}</p></div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><p className="text-[10px] text-slate-500">IGST</p><p className="text-lg font-bold text-slate-900">{Number(accounting?.igst || 0).toFixed(2)}</p></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 p-3"><p className="text-[11px] font-bold text-slate-800 mb-2">Source-wise Verified Earnings</p>{Object.entries(accounting?.sourceWiseEarnings || {}).length ? Object.entries(accounting.sourceWiseEarnings).map(([source, amount]: [string, any]) => <div key={source} className="flex justify-between text-xs py-1"><span className="text-slate-600">{source}</span><strong className="text-slate-900">₹{Number(amount).toFixed(2)}</strong></div>) : <p className="text-[11px] text-slate-500">No verified source entries.</p>}</div>
          <div className="rounded-xl border border-slate-200 p-3"><p className="text-[11px] font-bold text-slate-800 mb-2">GST Rate Breakdown</p>{Object.entries(accounting?.gstRateBreakdown || {}).length ? Object.entries(accounting.gstRateBreakdown).map(([rate, row]: [string, any]) => <div key={rate} className="text-[11px] text-slate-600 py-1">{rate} · Taxable ₹{Number(row.taxableAmount).toFixed(2)} · CGST ₹{Number(row.cgst).toFixed(2)} · SGST ₹{Number(row.sgst).toFixed(2)} · IGST ₹{Number(row.igst).toFixed(2)}</div>) : <p className="text-[11px] text-slate-500">No verified GST entries.</p>}</div>
        </div>
        <p className="text-[11px] text-amber-800">{accounting?.verifiedEntryCount ? accounting.verifiedEntryCount + ' verified ledger entries included.' : 'No verified invoice or earning entries are connected. Balance and GST are therefore reported as zero, not estimated.'}</p>
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <h4 className="text-xs font-bold text-slate-900">Request Payout · Manual Mode</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="number" min="0.01" step="0.01" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} placeholder="Amount (INR)" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs" />
            <input type="text" maxLength={240} value={payoutPurpose} onChange={e => setPayoutPurpose(e.target.value)} placeholder="Purpose of payout" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs" />
          </div>
          <button type="button" disabled={payoutBusy || !payoutAmount || Number(payoutAmount) <= 0 || !payoutPurpose.trim()} onClick={createPayoutRequest} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">Create Owner-Approval Request</button>
          <p className="text-[11px] text-amber-800">Auto-Payout: Requires Native Android Service Verification. No transfer can execute in this release.</p>
          {payoutMessage && <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">{payoutMessage}</p>}
          {payoutRequests.map((request: any) => <div key={request.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-200 rounded-xl p-3"><div><p className="text-xs font-semibold text-slate-800">₹{Number(request.amount).toLocaleString('en-IN')} · {request.purpose}</p><p className="text-[10px] text-slate-500">{request.status.replaceAll('_', ' ')}</p></div>{request.status === 'pending_owner_approval' && <button type="button" disabled={payoutBusy} onClick={() => recordOwnerApproval(request.id)} className="px-3 py-2 rounded-lg bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold">Record Owner Approval</button>}</div>)}
        </div>
      </section>

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
