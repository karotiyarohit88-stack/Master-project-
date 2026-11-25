import React, { useCallback, useEffect, useState } from 'react';
import { getCsrfHeaders } from '../utils/csrf';
import { LockKeyhole, LogIn, UserPlus, ShieldCheck, LogOut, Copy, Users, LoaderCircle, AlertCircle } from 'lucide-react';
import { UniversalVoiceGuide } from './UniversalVoiceGuide';

type AuthUser = { id: string; email: string; displayName: string; role: 'owner' | 'admin' | 'member' };
type AuthMode = 'login' | 'bootstrap' | 'invite';

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<AuthMode>(() => new URLSearchParams(window.location.search).has('invite') ? 'invite' : 'login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite') || '');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [generatedLink, setGeneratedLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [otpChallenge, setOtpChallenge] = useState<{ challengeToken: string; purpose: AuthMode } | null>(null);
  const [otp, setOtp] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);

  const checkSession = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (response.status === 401) {
        setUser(null);
        return;
      }
      const data = await readResponse(response);
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication service is unavailable.');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!otpChallenge) return;
    const updateCountdowns = () => {
      setResendSeconds(resendAvailableAt ? Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)) : 0);
      setOtpSecondsLeft(otpExpiresAt ? Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000)) : 0);
    };
    updateCountdowns();
    const timer = window.setInterval(updateCountdowns, 1000);
    return () => window.clearInterval(timer);
  }, [otpChallenge, otpExpiresAt, resendAvailableAt]);

  useEffect(() => {
    void checkSession();
    const handleExpired = () => { setUser(null); setMode('login'); setChecking(false); setNotice('Your session has expired. Please sign in again.'); };
    window.addEventListener('aaksh:session-expired', handleExpired);
    return () => window.removeEventListener('aaksh:session-expired', handleExpired);
  }, [checkSession]);

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      let endpoint = '/api/auth/login';
      let payload: Record<string, string> = { email, password };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (mode === 'bootstrap') {
        endpoint = '/api/auth/bootstrap-owner';
        payload = { email, password, displayName };
        headers['X-AAKSH-Admin-Token'] = adminToken;
      } else if (mode === 'invite') {
        endpoint = '/api/auth/accept-invitation';
        payload = { token: inviteToken, password, displayName };
      }
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(payload)
      });
      const data = await readResponse(response);
      if (response.status !== 202 || !data.requiresOtp || typeof data.challengeToken !== 'string') {
        throw new Error('The server did not start OTP verification. No account or session was activated.');
      }
      setOtpChallenge({ challengeToken: data.challengeToken, purpose: mode });
      setOtp('');
      setResendAvailableAt(Date.now() + 60 * 1000);
      setOtpExpiresAt(Date.now() + 10 * 60 * 1000);
      setOtpSecondsLeft(600);
      setNotice('A 6-digit verification code has been sent to your registered email address.');
      setPassword('');
      setAdminToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication request failed.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!otpChallenge || otp.length !== 6) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: otpChallenge.challengeToken, otp })
      });
      await readResponse(response);
      const purpose = otpChallenge.purpose;
      setOtpChallenge(null); setOtp(''); setOtpExpiresAt(null); setResendAvailableAt(null);
      if (purpose === 'invite') {
        setMode('login');
        setNotice('Email verified and invitation accepted. You can now sign in.');
      } else {
        await checkSession();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed. Check the code and try again.');
    } finally { setBusy(false); }
  };

  const resendOtp = async () => {
    if (!otpChallenge || resendSeconds > 0 || otpSecondsLeft <= 0) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: otpChallenge.challengeToken })
      });
      await readResponse(response);
      setOtp('');
      setResendAvailableAt(Date.now() + 60 * 1000);
      setOtpExpiresAt(Date.now() + 10 * 60 * 1000);
      setNotice('A new verification code has been sent. The previous code is no longer valid.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the verification code.');
    } finally { setBusy(false); }
  };

  const cancelOtp = () => {
    setOtpChallenge(null); setOtp(''); setOtpExpiresAt(null); setResendAvailableAt(null); setError('');
    setNotice('Verification cancelled. Submit the form again to request a new code.');
  };

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setGeneratedLink('');
    try {
      const response = await fetch('/api/auth/invitations', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, expiresInHours: 72 })
      });
      const data = await readResponse(response);
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('invite', data.invitationToken);
      setGeneratedLink(url.toString());
      setNotice('Invitation created. Copy the link now; the token is shown only once.');
      setInviteEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create invitation.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() }, body: '{}'
      });
      await readResponse(response);
      setUser(null);
      setMode('login');
      setNotice('You have been signed out.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed.');
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setNotice('Invitation link copied.');
    } catch {
      setNotice('Copy is unavailable in this browser. Select and copy the link below.');
    }
  };

  if (checking) {
    return <><div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600"><LoaderCircle className="w-5 h-5 animate-spin mr-2" /> Checking secure session…</div><UniversalVoiceGuide /></>;
  }

  if (!user) {
    return (
      <>
      <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 flex items-center justify-center p-4">
        <section className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <img src="/aaksh-ai-autopilot-icon.svg" alt="AAKSH AI AUTOPILOT" className="w-14 h-14 rounded-2xl shadow-md" />
            <div><h1 className="text-xl font-bold text-slate-900">AAKSH AI AUTOPILOT</h1><p className="text-xs text-slate-500">Secure Master Project workspace</p></div>
          </div>
          {!otpChallenge && <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-5">
            <button type="button" onClick={() => { setMode('login'); setError(''); }} className={`rounded-lg py-2 text-xs font-semibold ${mode === 'login' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}>Login</button>
            <button type="button" onClick={() => { setMode('bootstrap'); setError(''); }} className={`rounded-lg py-2 text-xs font-semibold ${mode === 'bootstrap' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}>First Owner</button>
            <button type="button" onClick={() => { setMode('invite'); setError(''); }} className={`rounded-lg py-2 text-xs font-semibold ${mode === 'invite' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}>Invitation</button>
          </div>}
          {otpChallenge ? (
            <div className="space-y-5">
              <div className="mb-5">
                <img src="/aaksh-ai-autopilot-icon.svg" alt="AAKSH AI AUTOPILOT" className="w-14 h-14 rounded-2xl shadow-md mb-3" />
                <h2 className="text-lg font-bold text-slate-900">Verify your email</h2>
                <p className="text-sm text-slate-500 mt-1">Enter the 6-digit code sent to the email address used in the previous step. The code expires in 10 minutes.</p>
              </div>
              {error && <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
              {notice && <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{notice}</div>}
              {otpSecondsLeft > 0 ? (
                <form onSubmit={verifyOtp} className="space-y-4">
                  <label className="block text-xs font-semibold text-slate-700">6-digit verification code
                    <input required autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="mt-2 w-full rounded-xl border border-slate-300 p-4 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-emerald-500" placeholder="••••••" aria-label="6-digit email verification code" />
                  </label>
                  <p className="text-xs text-slate-500 text-center">Code expires in <strong className="tabular-nums">{Math.floor(otpSecondsLeft / 60)}:{String(otpSecondsLeft % 60).padStart(2, '0')}</strong></p>
                  <button disabled={busy || otp.length !== 6} className="w-full min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2">{busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}Verify email</button>
                </form>
              ) : (
                <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">This verification code has expired. Start again to request a fresh code.</div>
              )}
              <button type="button" onClick={resendOtp} disabled={busy || resendSeconds > 0 || otpSecondsLeft <= 0} className="w-full min-h-11 rounded-xl border border-emerald-200 text-emerald-800 font-semibold disabled:opacity-50">{resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : otpSecondsLeft > 0 ? 'Resend verification code' : 'Code expired'}</button>
              <button type="button" onClick={cancelOtp} disabled={busy} className="w-full text-sm text-slate-500 hover:text-slate-800">Cancel and return to sign in</button>
            </div>
          ) : (
            <>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">{mode === 'login' ? 'Welcome back' : mode === 'bootstrap' ? 'Set up the first Owner' : 'Accept your invitation'}</h2>
            <p className="text-sm text-slate-500 mt-1">{mode === 'login' ? 'Sign in to open your protected dashboard.' : mode === 'bootstrap' ? 'Owner setup is available only once and requires the server bootstrap authorization token.' : 'Use the secure invitation token shared by your Owner.'}</p>
          </div>
          {error && <div role="alert" className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
          {notice && <div role="status" className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{notice}</div>}
          <form onSubmit={submitAuth} className="space-y-3">
            {mode === 'invite' && <label className="block text-xs font-semibold text-slate-700">Invitation token<input required value={inviteToken} onChange={e => setInviteToken(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-emerald-500" autoComplete="off" /></label>}
            {mode !== 'invite' && <label className="block text-xs font-semibold text-slate-700">Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-emerald-500" autoComplete="username" /></label>}
            {mode !== 'login' && <label className="block text-xs font-semibold text-slate-700">Display name<input required maxLength={100} value={displayName} onChange={e => setDisplayName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-emerald-500" autoComplete="name" /></label>}
            {mode === 'bootstrap' && <label className="block text-xs font-semibold text-slate-700">Server bootstrap authorization token<input required type="password" value={adminToken} onChange={e => setAdminToken(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-emerald-500" autoComplete="off" /><span className="block mt-1 text-[11px] font-normal text-slate-500">Enter the value configured by you in the server environment. It is sent only to the bootstrap endpoint and is not saved.</span></label>}
            <label className="block text-xs font-semibold text-slate-700">Password<input required type="password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-emerald-500" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><span className="block mt-1 text-[11px] font-normal text-slate-500">Use 12–128 characters.</span></label>
            <button disabled={busy} className="w-full min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2">{busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}{mode === 'login' ? 'Sign in securely' : mode === 'bootstrap' ? 'Create Owner account' : 'Accept invitation'}</button>
          </form>
          <p className="text-[11px] text-slate-400 mt-5 text-center flex items-center justify-center gap-1"><LockKeyhole className="w-3 h-3" /> Protected session • Secure, server-side authentication</p>
            </>
          )}
        </section>
      </main>
      <UniversalVoiceGuide />
      </>
    );
  }

  return (
    <>
      {children}
      <UniversalVoiceGuide />
      <aside className="fixed z-[60] top-2 right-2 sm:top-4 sm:right-4 flex items-center gap-2">
        <div className="hidden sm:block rounded-xl border border-slate-200 bg-white/95 shadow-md px-3 py-2 text-right"><p className="text-xs font-semibold text-slate-800">{user.displayName}</p><p className="text-[10px] text-slate-500">{user.role} · {user.email}</p></div>
        {user.role === 'owner' && <details className="relative"><summary className="list-none cursor-pointer rounded-xl border border-emerald-200 bg-white shadow-md p-2.5 text-emerald-700" aria-label="Invite team members"><Users className="w-5 h-5" /></summary><div className="absolute right-0 mt-2 w-[min(90vw,340px)] rounded-2xl border border-slate-200 bg-white shadow-xl p-4"><h3 className="font-bold text-slate-900 mb-1">Invite team member</h3><p className="text-xs text-slate-500 mb-3">Create a one-time invitation link. The token is shown only once.</p><form onSubmit={createInvitation} className="space-y-2"><input required type="email" placeholder="member@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm" /><select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'member' | 'admin')} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm"><option value="member">Member</option><option value="admin">Admin</option></select><button disabled={busy} className="w-full rounded-xl bg-emerald-600 text-white py-2.5 text-sm font-semibold disabled:opacity-60">{busy ? 'Creating…' : 'Generate invitation link'}</button></form>{generatedLink && <div className="mt-3"><textarea readOnly value={generatedLink} className="w-full h-20 rounded-lg border border-slate-200 p-2 text-xs break-all" /><button type="button" onClick={copyInvite} className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-50 text-emerald-800 py-2 text-xs font-semibold"><Copy className="w-3.5 h-3.5" />Copy invitation link</button></div>}{error && <p role="alert" className="text-xs text-amber-700 mt-2">{error}</p>}{notice && <p role="status" className="text-xs text-emerald-700 mt-2">{notice}</p>}</div></details>}
        <button type="button" onClick={logout} disabled={busy} className="rounded-xl border border-slate-200 bg-white shadow-md p-2.5 text-slate-600 hover:text-amber-700 disabled:opacity-60" aria-label="Logout" title="Logout"><LogOut className="w-5 h-5" /></button>
      </aside>
      {(error || notice) && <div className={`fixed z-[70] bottom-4 right-3 max-w-sm rounded-xl border p-3 text-xs shadow-lg ${error ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>{error || notice}<button type="button" onClick={() => { setError(''); setNotice(''); }} className="ml-3 font-bold">×</button></div>}
    </>
  );
};
