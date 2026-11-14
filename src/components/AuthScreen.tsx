import React,{useState} from 'react';

type Props={onAuthenticated:(user:any)=>void};
export function AuthScreen({onAuthenticated}:Props){
 const [mode,setMode]=useState<'login'|'register'|'reset'>('login');
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [code,setCode]=useState('');const [displayName,setDisplayName]=useState('');
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const request=async(path:string,body:any)=>{
  setBusy(true);setMessage('');
  try{const r=await fetch('/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');return data;}
  catch(e:any){setMessage(e.message||'Network error');return null;}finally{setBusy(false);}
 };
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(mode==='login'){const d=await request('login',{email,password});if(d?.user)onAuthenticated(d.user);return;}
  if(mode==='register'){const d=await request('register',{email,password,code,displayName});if(d?.user)onAuthenticated(d.user);return;}
  const d=await request('reset-password',{email,password,code});if(d)setMessage('Password updated. Please log in.');if(d)setMode('login');
 };
 const sendCode=async()=>{const d=await request('request-otp',{email,purpose:mode==='reset'?'password_reset':'register'});if(d)setMessage('OTP sent. It is valid for 60 seconds. Resend is locked for 60 seconds.');};
 return <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-50 p-4">
  <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl">
   <div className="mb-6 text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 text-2xl font-bold">A</div><h1 className="text-2xl font-bold text-slate-900">Master Project</h1><p className="mt-1 text-sm text-slate-500">Secure account access</p></div>
   <div className="mb-5 flex gap-2 rounded-xl bg-slate-100 p-1">{(['login','register','reset'] as const).map(x=><button type="button" key={x} onClick={()=>{setMode(x);setMessage('')}} className={'flex-1 rounded-lg px-2 py-2 text-xs font-semibold '+(mode===x?'bg-white text-emerald-700 shadow':'text-slate-500')}>{x==='login'?'Login':x==='register'?'Create account':'Reset password'}</button>)}</div>
   {mode==='register'&&<label className="mb-3 block text-sm font-medium text-slate-700">Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3" maxLength={100}/></label>}
   <label className="mb-3 block text-sm font-medium text-slate-700">Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/></label>
   {mode!=='login'&&<><label className="mb-3 block text-sm font-medium text-slate-700">6-digit email OTP<div className="mt-1 flex gap-2"><input required inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\\D/g,'').slice(0,6))} className="min-w-0 flex-1 rounded-xl border border-slate-200 p-3"/><button type="button" disabled={busy||!email} onClick={sendCode} className="rounded-xl border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 disabled:opacity-50">Send OTP</button></div></label></>}
   <label className="mb-4 block text-sm font-medium text-slate-700">Password<input type="password" required minLength={mode==='login'?1:10} value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3"/>{mode!=='login'&&<span className="text-xs text-slate-400">At least 10 characters</span>}</label>
   {message&&<p role="status" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}
   <button disabled={busy} className="w-full rounded-xl bg-emerald-600 p-3 font-semibold text-white disabled:opacity-50">{busy?'Please wait…':mode==='login'?'Login securely':mode==='register'?'Verify OTP & create account':'Reset password'}</button>
   <p className="mt-4 text-center text-xs text-slate-400">Protected by server-validated sessions</p>
  </form>
 </div>;
}
