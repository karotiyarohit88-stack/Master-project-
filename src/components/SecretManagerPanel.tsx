import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, RefreshCw, Trash2, ShieldCheck, AlertCircle, LoaderCircle } from 'lucide-react';

type SecretItem = {
  id: string;
  name: string;
  provider: string;
  masked_preview: string;
  created_at: string;
};

export const SecretManagerPanel: React.FC = () => {
  const [authorized, setAuthorized] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('OpenAI');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSecrets = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/secrets');
      if (response.status === 403) {
        setAuthorized(false);
        setLoaded(true);
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to load saved secrets.');
      setSecrets(Array.isArray(data.secrets) ? data.secrets : []);
      setAuthorized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Secret Manager is unavailable.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void loadSecrets(); }, [loadSecrets]);

  const saveSecret = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !secret) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), provider, secret })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Secret could not be saved.');
      setName('');
      setSecret('');
      setNotice('Secret encrypted and saved. The full value will not be shown again.');
      await loadSecrets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Secret could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const revokeSecret = async (id: string) => {
    if (!window.confirm('Revoke this saved secret? This action cannot be undone.')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/secrets/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Secret could not be revoked.');
      setSecrets(current => current.filter(item => item.id !== id));
      setNotice('Secret revoked. Its encrypted record is retained only as a revoked record.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Secret could not be revoked.');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded || !authorized) return null;

  return (
    <section className="mt-5 rounded-3xl border border-emerald-200 bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
          <div><h2 className="text-base sm:text-lg font-bold text-slate-900">API Keys &amp; Secrets</h2><p className="text-xs text-slate-500">Owner-only encrypted credential vault</p></div>
        </div>
        <button type="button" onClick={() => void loadSecrets()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
      </div>

      <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-900 flex gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Secrets are encrypted on the server with AES-256-GCM. The full value is never returned by the list API. Keep your encryption key backed up securely.</span>
      </div>

      {error && <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      {notice && <div role="status" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}

      <form onSubmit={saveSecret} className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
        <label className="text-xs font-semibold text-slate-700">Secret name
          <input required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. OpenAI Production" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal outline-none focus:border-emerald-500" />
        </label>
        <label className="text-xs font-semibold text-slate-700">Provider
          <select value={provider} onChange={event => setProvider(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal outline-none focus:border-emerald-500">
            <option>OpenAI</option><option>Google Gemini</option><option>GitHub</option><option>ElevenLabs</option><option>Runway</option><option>Custom</option>
          </select>
        </label>
        <label className="sm:col-span-2 text-xs font-semibold text-slate-700">API key / secret value
          <input required type="password" autoComplete="new-password" maxLength={8192} value={secret} onChange={event => setSecret(event.target.value)} placeholder="Paste the secret value here" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal outline-none focus:border-emerald-500" />
          <span className="block mt-1 text-[10px] font-normal text-slate-500">The value is sent only to the authenticated server over this same-origin session and is not stored in browser storage.</span>
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" disabled={busy || !name.trim() || !secret} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Save encrypted secret</button>
        </div>
      </form>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-bold text-slate-900">Saved secrets</h3><span className="text-[11px] text-slate-500">{secrets.length} active</span></div>
        {secrets.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">No secrets saved yet.</div> : (
          <div className="space-y-2">
            {secrets.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{item.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{item.provider} · <span className="font-mono">{item.masked_preview}</span></p><p className="mt-0.5 text-[10px] text-slate-400">{new Date(item.created_at).toLocaleString()}</p></div>
                <button type="button" onClick={() => void revokeSecret(item.id)} disabled={busy} aria-label={`Revoke ${item.name}`} title="Revoke secret" className="shrink-0 rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
