import React from 'react';
import { Database, RefreshCw, ShieldCheck, AlertTriangle, Play, CheckCircle2 } from 'lucide-react';
import { getCsrfHeaders } from '../utils/csrf';

type MigrationStatus = {
  provider?: string;
  configured?: boolean;
  connected?: boolean;
  database?: string;
  serverVersion?: string;
  migrationTableExists?: boolean;
  appliedMigrations?: string[];
  error?: string;
  migrationStatusError?: string;
};

const TARGET_MIGRATION = '20261126_001_ai_conversation_memory.sql';

export const DatabaseMigrationCard: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  const [verifiedOwner, setVerifiedOwner] = React.useState(false);
  const [haltClear, setHaltClear] = React.useState(false);
  const [adminToken, setAdminToken] = React.useState('');
  const [status, setStatus] = React.useState<MigrationStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  const refresh = React.useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [meResponse, haltResponse] = await Promise.all([
        fetch('/api/auth/me', { credentials: 'same-origin' }),
        fetch('/api/emergency-halt', { credentials: 'same-origin' })
      ]);
      if (!meResponse.ok || !haltResponse.ok) {
        setVerifiedOwner(false);
        setHaltClear(false);
        setStatus(null);
        return;
      }
      const [me, halt] = await Promise.all([meResponse.json(), haltResponse.json()]);
      const isOwner = me?.authenticated === true && me?.user?.role === 'owner';
      const isClear = halt?.success === true && halt?.state?.halted === false;
      setVerifiedOwner(isOwner);
      setHaltClear(isClear);
      if (!isOwner || !isClear) {
        setStatus(null);
        return;
      }
      const response = await fetch('/api/database/status', { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      setStatus(data);
      if (!response.ok) setError(data.error || data.migrationStatusError || 'Database status could not be read.');
    } catch {
      setVerifiedOwner(false);
      setHaltClear(false);
      setStatus(null);
      setError('Owner, Emergency Halt, or database status could not be verified.');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) void refresh();
    else {
      setAdminToken('');
      setMessage('');
      setError('');
    }
  }, [isOpen, refresh]);

  const apply = async () => {
    if (!verifiedOwner || !haltClear || !status?.connected || !status.database || !adminToken.trim() || busy) return;
    if (!window.confirm('Apply only 20261126_001_ai_conversation_memory.sql to ' + status.database + '? This includes ' + TARGET_MIGRATION + '.')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/database/migrate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-aaksh-admin-token': adminToken.trim(),
          ...getCsrfHeaders()
        },
        body: JSON.stringify({ confirm: true, expectedDatabase: status.database, targetMigration: TARGET_MIGRATION })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success !== true) throw new Error(data.error || 'Migration was not applied.');
      setMessage('Migration run completed. Applied: ' + ((data.applied || []).join(', ') || 'none') + '. Already applied: ' + ((data.alreadyApplied || []).join(', ') || 'none') + '.');
      setAdminToken('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration request failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen || !verifiedOwner || !haltClear) return null;

  const applied = status?.appliedMigrations || [];
  const targetApplied = applied.includes(TARGET_MIGRATION);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3" aria-labelledby="database-migration-title">
      <div className="flex items-start gap-2">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700"><Database className="w-4 h-4" /></div>
        <div className="min-w-0 flex-1">
          <h4 id="database-migration-title" className="text-sm font-bold text-slate-900">Database Migration Status &amp; Apply</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">Owner-only • Emergency Halt must remain OFF • Secrets are never stored in the browser</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={busy} className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-50" aria-label="Refresh database migration status">
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {status && <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
        <p><strong>Database:</strong> {status.database || 'Not verified'}</p>
        <p><strong>Connection:</strong> {status.connected ? 'Connected' : 'Not connected'}</p>
        <p><strong>PostgreSQL:</strong> {status.serverVersion || 'Unknown'}</p>
        <p><strong>Target migration:</strong> {targetApplied ? 'Already applied' : 'Pending / not recorded'}</p>
        <p><strong>Migration ledger:</strong> {status.migrationTableExists ? 'Available' : 'Not created yet'}</p>
        {applied.length > 0 && <p className="break-words"><strong>Applied:</strong> {applied.join(', ')}</p>}
      </div>}

      {!status?.connected && <p className="text-xs text-amber-800 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> PostgreSQL connection must be healthy before migration can run.</p>}
      {targetApplied && <p className="text-xs text-emerald-700 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> The requested migration is already recorded as applied.</p>}

      {!targetApplied && <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-700" htmlFor="migration-admin-token">AAKSH Admin Token</label>
        <input id="migration-admin-token" type="password" autoComplete="off" value={adminToken} onChange={event => setAdminToken(event.target.value)} placeholder="Enter server-configured Admin Token" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" />
        <button type="button" onClick={() => void apply()} disabled={busy || !status?.connected || !adminToken.trim()} className="w-full min-h-11 rounded-lg bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
          <Play className="w-4 h-4" /> {busy ? 'Checking / Applying…' : 'Apply Conversation Memory Migration'}
        </button>
        <p className="text-[10px] text-slate-500 flex gap-1.5"><ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Requires current Owner session, CSRF validation, Admin Token, verified database name, and clear Emergency Halt. The server temporarily enables migration permission only for this confirmed request and applies only the named migration.</p>
      </div>}
      {message && <p role="status" className="text-xs text-emerald-700 break-words">{message}</p>}
      {error && <p role="alert" className="text-xs text-red-700 break-words">{error}</p>}
    </section>
  );
};
