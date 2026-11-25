import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus, Pause, Play, Trash2, RefreshCw } from 'lucide-react';
import { getCsrfHeaders } from '../utils/csrf';

type Schedule = { id: string; title: string; original_prompt: string; recurrence_type: 'daily' | 'interval'; timezone: string; daily_time: string | null; interval_minutes: number | null; next_run_at: string; enabled: boolean; last_run_at: string | null; last_task_id: string | null };
type Language = 'hi' | 'hinglish' | 'en';
const COPY = {
  hi: { title: 'वास्तविक दैनिक शेड्यूलर', description: 'सर्वर-आधारित शेड्यूल; समय आने पर सुरक्षित read-only कार्य queue में जाएगा।', name: 'शेड्यूल का नाम', prompt: 'कार्य निर्देश', daily: 'रोज़', interval: 'हर अंतराल', time: 'समय', hours: 'हर कितने मिनट', create: 'शेड्यूल बनाएं', next: 'अगला रन', pause: 'रोकें', resume: 'चालू करें', delete: 'हटाएं', empty: 'अभी कोई शेड्यूल नहीं है।', safety: 'अभी automatic handler केवल Project Status पढ़ता है। Publishing, payment और बाहरी actions स्वतः नहीं चलेंगे।', timezone: 'समय क्षेत्र' },
  hinglish: { title: 'Real Daily Scheduler', description: 'Server schedule; due time par safe read-only task queue hoga.', name: 'Schedule name', prompt: 'Task instruction', daily: 'Daily', interval: 'Interval', time: 'Time', hours: 'Interval minutes', create: 'Create schedule', next: 'Next run', pause: 'Pause', resume: 'Resume', delete: 'Delete', empty: 'No schedules yet.', safety: 'Abhi automatic handler sirf Project Status read karta hai. Publishing, payment aur external actions auto nahi honge.', timezone: 'Timezone' },
  en: { title: 'Real Daily Scheduler', description: 'Server-backed schedule; due tasks are added to the durable queue.', name: 'Schedule name', prompt: 'Task instruction', daily: 'Daily', interval: 'Interval', time: 'Time', hours: 'Interval minutes', create: 'Create schedule', next: 'Next run', pause: 'Pause', resume: 'Resume', delete: 'Delete', empty: 'No schedules yet.', safety: 'The automatic handler currently reads Project Status only. Publishing, payments, and external actions will not run automatically.', timezone: 'Timezone' }
};

export const ScheduleManager: React.FC = () => {
  const [language] = useState<Language>(() => {
    try { const value = localStorage.getItem('aaksh_voice_language'); return value === 'en' || value === 'hinglish' ? value : 'hi'; } catch { return 'hi'; }
  });
  const copy = COPY[language];
  const [items, setItems] = useState<Schedule[]>([]);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('Read the current project status and save the result.');
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'interval'>('daily');
  const [dailyTime, setDailyTime] = useState('09:00');
  const [intervalMinutes, setIntervalMinutes] = useState(360);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try { const response = await fetch('/api/schedules'); const data = await response.json(); if (response.ok) setItems(data.schedules || []); else setMessage(data.error || 'Schedules unavailable.'); }
    catch { setMessage('Schedule service unavailable.'); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, [load]);

  const create = async () => {
    if (!title.trim() || !prompt.trim()) { setMessage('Enter a schedule name and task instruction.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() }, body: JSON.stringify({ title, prompt, recurrenceType, dailyTime, intervalMinutes, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Schedule could not be created.');
      setTitle(''); await load(); setMessage('Schedule saved. The dedicated background worker must be enabled to dispatch it.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Schedule could not be created.'); }
    finally { setBusy(false); }
  };

  const toggle = async (item: Schedule) => {
    setBusy(true);
    try { const response = await fetch('/api/schedules/' + item.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() }, body: JSON.stringify({ enabled: !item.enabled }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Schedule update failed.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Schedule update failed.'); }
    finally { setBusy(false); }
  };
  const remove = async (item: Schedule) => {
    if (!window.confirm('Delete this schedule? Queued tasks already created will remain in the task queue.')) return;
    setBusy(true);
    try { const response = await fetch('/api/schedules/' + item.id, { method: 'DELETE', headers: getCsrfHeaders() }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Schedule deletion failed.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Schedule deletion failed.'); }
    finally { setBusy(false); }
  };

  return <section className="rounded-2xl border border-[#14183E]/15 bg-white p-4 sm:p-5 mb-4 shadow-sm">
    <div className="flex items-center gap-2 mb-2"><CalendarClock className="w-5 h-5 text-[#14183E]"/><h3 className="font-bold text-sm text-slate-900">{copy.title}</h3></div>
    <p className="text-xs text-slate-500 mb-3">{copy.description}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <label className="text-xs font-semibold">{copy.name}<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal" placeholder="Daily project report"/></label>
      <label className="text-xs font-semibold">{copy.prompt}<input value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={4000} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal"/></label>
      <label className="text-xs font-semibold">Recurrence<select value={recurrenceType} onChange={e=>setRecurrenceType(e.target.value as 'daily'|'interval')} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"><option value="daily">{copy.daily}</option><option value="interval">{copy.interval}</option></select></label>
      {recurrenceType === 'daily' ? <label className="text-xs font-semibold">{copy.time}<input type="time" value={dailyTime} onChange={e=>setDailyTime(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label> : <label className="text-xs font-semibold">{copy.hours}<input type="number" min={15} max={10080} step={15} value={intervalMinutes} onChange={e=>setIntervalMinutes(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"/></label>}
      <div className="text-xs text-slate-500 self-end pb-2">{copy.timezone}: {Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'}</div>
      <button type="button" onClick={()=>void create()} disabled={busy} className="rounded-xl bg-[#14183E] text-white px-3 py-2 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Plus size={15}/>{copy.create}</button>
    </div>
    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-3">{copy.safety}</p>
    {message && <p role="status" className="text-xs mt-2 text-slate-700">{message}</p>}
    <div className="mt-3 space-y-2">
      {items.length === 0 ? <p className="text-xs text-slate-500">{copy.empty}</p> : items.map(item=><div key={item.id} className="rounded-xl border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><p className="text-xs font-bold text-slate-900">{item.title}</p><p className="text-[11px] text-slate-500">{item.recurrence_type === 'daily' ? 'Daily ' + String(item.daily_time || '').slice(0,5) : 'Every ' + item.interval_minutes + ' min'} · {copy.next}: {new Date(item.next_run_at).toLocaleString()}</p><p className="text-[10px] text-slate-500 truncate">{item.original_prompt}</p></div>
        <div className="flex gap-1"><button type="button" disabled={busy} onClick={()=>void toggle(item)} aria-label={item.enabled?copy.pause:copy.resume} className="rounded-lg border border-slate-300 p-2 text-[#14183E]">{item.enabled?<Pause size={15}/>:<Play size={15}/>}</button><button type="button" disabled={busy} onClick={()=>void remove(item)} aria-label={copy.delete} className="rounded-lg border border-slate-300 p-2 text-red-700"><Trash2 size={15}/></button><button type="button" onClick={()=>void load()} aria-label="Refresh" className="rounded-lg border border-slate-300 p-2"><RefreshCw size={15}/></button></div>
      </div>)}
    </div>
  </section>;
};
