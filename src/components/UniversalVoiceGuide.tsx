import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Volume2, VolumeX, Sparkles, X, Accessibility, ChevronRight, Focus, ShieldCheck } from 'lucide-react';
import { findVoiceControl, isHighImpactVoiceAction, normalizeVoiceText } from '../utils/voiceCommandParser';

type Language = 'hi' | 'hinglish' | 'en';
type SpeechRecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};
declare global { interface Window { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition } }

const COPY = {
  hi: { title: 'AI Mic & Speaker Guide', read: 'पूरी स्क्रीन पढ़ें', stop: 'आवाज़ रोकें', listen: 'आवाज़ से कमांड', questions: 'इस स्क्रीन के स्मार्ट सवाल', accessibility: 'Accessibility Mode', autopilot: 'Voice Command Mode', on: 'चालू', off: 'बंद', language: 'भाषा', help: 'नीचे इस स्क्रीन पर मौजूद वास्तविक controls दिए गए हैं। किसी step को चुनने पर संबंधित control पर focus होगा।', noSpeech: 'इस browser में voice recognition उपलब्ध नहीं है।', empty: 'इस स्क्रीन पर पढ़ने योग्य मुख्य सामग्री नहीं मिली।', enabled: 'Voice command चालू है। बोलें: खोलो + tab का नाम, पढ़ो स्क्रीन, या रोक दो।', disabled: 'Voice command बंद है।', confirm: 'क्या आप इस action को चलाना चाहते हैं?', q1: 'इस पेज पर क्या कर सकते हैं?', q2: 'अगला सुरक्षित कदम क्या है?', q3: 'किस button या field का उपयोग करना है?', q4: 'इस स्क्रीन के विकल्प पढ़ें।', q5: 'मुझे अगले control तक ले चलें।' },
  hinglish: { title: 'AI Mic & Speaker Guide', read: 'Full screen read karo', stop: 'Voice stop karo', listen: 'Voice command', questions: 'Screen ke smart questions', accessibility: 'Accessibility Mode', autopilot: 'Voice Command Mode', on: 'ON', off: 'OFF', language: 'Language', help: 'Neeche is screen ke real controls hain. Step select karne par related control focus hoga.', noSpeech: 'Is browser mein voice recognition available nahi hai.', empty: 'Is screen par readable content nahi mila.', enabled: 'Voice command ON hai. Bolein: open + tab name, read screen, ya stop.', disabled: 'Voice command OFF hai.', confirm: 'Kya aap ye action chalana chahte hain?', q1: 'Is page par kya kar sakte hain?', q2: 'Next safe step kya hai?', q3: 'Kaunsa button ya field use karna hai?', q4: 'Screen ke options read karo.', q5: 'Mujhe next control tak le chalo.' },
  en: { title: 'AI Mic & Speaker Guide', read: 'Read full screen', stop: 'Stop speaking', listen: 'Voice command', questions: 'Smart questions for this screen', accessibility: 'Accessibility Mode', autopilot: 'Voice Command Mode', on: 'ON', off: 'OFF', language: 'Language', help: 'The actual controls on this screen are listed below. Selecting a step focuses its matching control.', noSpeech: 'Speech recognition is unavailable in this browser.', empty: 'No readable main content was found on this screen.', enabled: 'Voice commands are on. Say: open + tab name, read screen, or stop.', disabled: 'Voice commands are off.', confirm: 'Do you want to run this action?', q1: 'What can I do on this page?', q2: 'What is the next safe step?', q3: 'Which button or field should I use?', q4: 'Read the options on this screen.', q5: 'Take me to the next control.' }
};
const NAV_NAMES = ['Home', 'AI Chat', 'GitHub Explorer', 'Analytics', 'AAKSH Workspace', 'Auto Pilot', 'Video Gen', 'Voice Studio', 'Publishing', 'Connections', 'Audit Logs', 'Camera Studio'];

export const UniversalVoiceGuide: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<Language>(() => {
    try { const saved = localStorage.getItem('aaksh_voice_language'); return saved === 'hi' || saved === 'hinglish' || saved === 'en' ? saved : 'hi'; } catch { return 'hi'; }
  });
  const [accessibility, setAccessibility] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const [pageText, setPageText] = useState('');
  const recognitionRef = useRef<Recognition | null>(null);
  const voiceModeRef = useRef(false);
  const copy = COPY[language];

  useEffect(() => {
    try { localStorage.setItem('aaksh_voice_language', language); } catch { /* storage may be blocked */ }
    document.documentElement.lang = language === 'hi' ? 'hi' : 'en';
  }, [language]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
    if (!voiceMode) { recognitionRef.current?.stop(); setListening(false); }
  }, [voiceMode]);

  useEffect(() => {
    if (!accessibility) return;
    const style = document.createElement('style');
    style.id = 'aaksh-accessibility-enhancements';
    style.textContent = 'body.aaksh-accessibility :focus-visible{outline:3px solid #14183E!important;outline-offset:3px!important} body.aaksh-accessibility button,body.aaksh-accessibility input,body.aaksh-accessibility select,body.aaksh-accessibility textarea{scroll-margin:110px} body.aaksh-accessibility button{min-height:40px}';
    document.head.appendChild(style);
    document.body.classList.add('aaksh-accessibility');
    return () => { style.remove(); document.body.classList.remove('aaksh-accessibility'); };
  }, [accessibility]);

  const getTargets = useCallback(() => Array.from(document.querySelectorAll<HTMLElement>('main h1,main h2,main h3,main button,main a,main label,main input,main select,main textarea,main [role="button"],header nav button'))
    .filter(el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && !el.closest('[aria-label="Universal voice and accessibility controls"]'))
    .slice(0, 60), []);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) { setSpokenText(text); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.94;
    window.speechSynthesis.speak(utterance);
  }, [language]);

  const readScreen = useCallback(() => {
    const main = document.querySelector('main') || document.querySelector('#root');
    const text = (main?.textContent || document.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 6500);
    const items = getTargets();
    setTargets(items);
    setPageText(text);
    if (!text) { setSpokenText(copy.empty); speak(copy.empty); return; }
    const intro = language === 'hi' ? 'मैं इस स्क्रीन की सामग्री पढ़ रहा हूँ। ' : language === 'hinglish' ? 'Main is screen ka content read kar raha hoon. ' : 'Reading the content on this screen. ';
    setSpokenText(text.slice(0, 500));
    speak(intro + text);
  }, [copy.empty, getTargets, language, speak]);

  const focusTarget = useCallback((el: HTMLElement, index: number) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
    el.classList.add('ring-4', 'ring-indigo-500', 'ring-offset-2');
    window.setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-500', 'ring-offset-2'), 2400);
    const label = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.tagName).trim();
    const message = (language === 'hi' ? 'Step ' : 'Step ') + (index + 1) + ': ' + label;
    setSpokenText(message);
    speak(message);
  }, [language, speak]);

  const scanScreen = useCallback(() => {
    const items = getTargets();
    setTargets(items);
    const main = document.querySelector('main') || document.querySelector('#root');
    setPageText((main?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 6500));
    return items;
  }, [getTargets]);

  const executeVoiceCommand = useCallback((raw: string) => {
    const command = normalizeVoiceText(raw);
    if (!command) return;
    if (/^(stop|रोक|बंद|आवाज बंद)/u.test(command)) { window.speechSynthesis?.cancel(); voiceModeRef.current = false; setVoiceMode(false); return; }
    if (command.includes('read screen') || command.includes('स्क्रीन पढ़') || command.includes('screen reader')) { setAccessibility(true); readScreen(); return; }
    if (command.includes('accessibility mode on') || command.includes('accessibility चालू')) { setAccessibility(true); return; }
    if (command.includes('accessibility mode off') || command.includes('accessibility बंद')) { setAccessibility(false); return; }
    if (command.includes('voice autopilot off') || command.includes('voice command mode off')) { voiceModeRef.current = false; setVoiceMode(false); return; }
    const nav = NAV_NAMES.find(name => command.includes(normalizeVoiceText(name)) || (name === 'Auto Pilot' && command.includes('autopilot')));
    if (nav && (command.startsWith('open ') || command.startsWith('खोलो ') || command.startsWith('go to ') || command.includes('open '))) {
      const button = Array.from(document.querySelectorAll<HTMLElement>('header nav button,[aria-label="Bottom navigation"] button')).find(el => normalizeVoiceText(el.innerText || el.getAttribute('aria-label') || '').includes(normalizeVoiceText(nav)));
      if (button) { button.click(); setSpokenText('Opening ' + nav); speak('Opening ' + nav); return; }
    }
    const controls = getTargets();
    const candidates = controls.map(el => ({
      element: el,
      label: [el.innerText, el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('name'), el.getAttribute('title')].filter(Boolean).join(' '),
      kind: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? 'input' as const : el instanceof HTMLSelectElement ? 'select' as const : el instanceof HTMLButtonElement ? 'button' as const : el instanceof HTMLAnchorElement ? 'link' as const : 'other' as const,
      isSubmit: el instanceof HTMLButtonElement && (el.type === 'submit' || !!el.closest('form'))
    }));
    const candidate = findVoiceControl(command, candidates);
    const match = candidate?.element;
    if (!match) { setSpokenText(language === 'hi' ? 'यह command किसी सुरक्षित visible control से match नहीं हुई।' : 'No safe visible control matched that command.'); return; }
    if (match instanceof HTMLInputElement || match instanceof HTMLTextAreaElement) { match.focus(); match.scrollIntoView({ behavior: 'smooth', block: 'center' }); setSpokenText('Focused ' + (match.getAttribute('aria-label') || match.placeholder || match.name || 'input')); return; }
    if (match instanceof HTMLSelectElement) { match.focus(); setSpokenText('Select field focused. Choose an option using the screen control.'); return; }
    if (candidate && isHighImpactVoiceAction(candidate) && !window.confirm(copy.confirm)) return;
    match.click();
    setSpokenText('Activated ' + (match.innerText || match.getAttribute('aria-label') || 'control'));
  }, [copy.confirm, getTargets, language, readScreen, speak]);

  const createRecognition = useCallback((continuous: boolean) => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { setSpokenText(copy.noSpeech); return; }
    const recognition = new Ctor();
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.continuous = continuous;
    recognition.interimResults = false;
    recognition.onresult = event => executeVoiceCommand(event.results?.[event.results.length - 1]?.[0]?.transcript || '');
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      if (continuous && voiceModeRef.current) window.setTimeout(() => {
        if (voiceModeRef.current) { try { recognition.start(); setListening(true); } catch { setListening(false); } }
      }, 450);
    };
    recognitionRef.current?.stop();
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); } catch { setListening(false); setSpokenText(copy.noSpeech); }
  }, [copy.noSpeech, executeVoiceCommand, language]);

  const toggleVoiceMode = () => {
    if (voiceMode) { voiceModeRef.current = false; setVoiceMode(false); setSpokenText(copy.disabled); return; }
    if (!window.confirm(language === 'hi' ? 'Voice Command Mode microphone ko active rakhega jab tak aap ise OFF nahi karte. अनुमति दें?' : 'Enable continuous microphone listening until you turn Voice Command Mode off?')) return;
    setVoiceMode(true);
    voiceModeRef.current = true;
    createRecognition(true);
    setSpokenText(copy.enabled);
  };

  const explainQuestion = (question: string) => {
    const items = scanScreen();
    const labels = items.map(el => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName).trim()).filter(Boolean);
    const result = [question, copy.help, ...labels.slice(0, 12).map((label, i) => (i + 1) + '. ' + label)];
    setSpokenText(result.join(' '));
    speak(result.join(' '));
  };

  useEffect(() => () => { voiceModeRef.current = false; recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);

    const targetLabel = (el: HTMLElement) => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 90);

  const firstControlQuestion = targets[0] ? (language === 'hi' ? `इस control का उपयोग कैसे करें: ${targetLabel(targets[0])}?` : language === 'hinglish' ? `Is control ko kaise use karein: ${targetLabel(targets[0])}?` : `How do I use: ${targetLabel(targets[0])}?`) : copy.q3;
  const nextControlQuestion = targets.length ? (language === 'hi' ? `अगले control पर जाएँ: ${targetLabel(targets[1] || targets[0])}` : `Go to next control: ${targetLabel(targets[1] || targets[0])}`) : copy.q5;
  const actionQuestions = [copy.q1, copy.q2, firstControlQuestion, copy.q4, nextControlQuestion];

  return <div className="fixed z-[80] bottom-4 right-3 sm:right-5 flex flex-col items-end gap-2" aria-label="Universal voice and accessibility controls">
    {open && <section className="w-[min(92vw,390px)] max-h-[78dvh] overflow-y-auto rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-2xl p-4" aria-label={copy.title}>
      <div className="flex items-center justify-between gap-2 mb-3"><h2 className="font-bold text-sm">{copy.title}</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close voice guide" className="p-2 rounded-lg hover:bg-slate-100"><X size={17}/></button></div>
      <label className="block text-xs font-semibold mb-1">{copy.language}</label>
      <select aria-label="Choose voice language" value={language} onChange={e => setLanguage(e.target.value as Language)} className="w-full rounded-xl border border-slate-300 p-2.5 mb-3 text-sm"><option value="hi">हिन्दी</option><option value="hinglish">Hinglish</option><option value="en">English</option></select>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={readScreen} className="rounded-xl bg-[#14183E] text-white p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><Volume2 size={16}/>{copy.read}</button>
        <button type="button" onClick={() => window.speechSynthesis?.cancel()} className="rounded-xl border border-slate-300 p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><VolumeX size={16}/>{copy.stop}</button>
        <button type="button" onClick={() => createRecognition(false)} className="rounded-xl bg-[#14183E] text-white p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><Mic size={16}/>{listening ? 'Listening…' : copy.listen}</button>
        <button type="button" onClick={() => setAccessibility(v => !v)} aria-pressed={accessibility} className="rounded-xl border border-slate-300 p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><Accessibility size={16}/>{copy.accessibility}: {accessibility ? copy.on : copy.off}</button>
      </div>
      <button type="button" onClick={toggleVoiceMode} aria-pressed={voiceMode} className="w-full mt-2 rounded-xl border border-[#14183E] text-[#14183E] p-2.5 text-xs font-bold flex items-center justify-center gap-2"><ShieldCheck size={15}/>{copy.autopilot}: {voiceMode ? copy.on : copy.off}</button>
      <p className="text-[10px] text-slate-500 mt-2">Continuous listening is enabled only after explicit confirmation. It stops when you turn this mode off or leave the page. Critical actions still require confirmation.</p>
      <h3 className="text-xs font-bold mt-4 mb-2 flex items-center gap-2"><Sparkles size={14}/>{copy.questions}</h3>
      <div className="space-y-1.5">{actionQuestions.map(q => <button type="button" key={q} onClick={() => explainQuestion(q)} className="w-full text-left rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2.5 text-xs flex items-center justify-between gap-2">{q}<ChevronRight size={14}/></button>)}</div>
      <button type="button" onClick={scanScreen} className="mt-2 text-xs underline text-[#14183E]">Refresh screen controls</button>
      {spokenText && <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-2 text-xs">{spokenText}</p>}
      {targets.length > 0 && <div className="mt-3 rounded-xl border border-[#14183E]/20 bg-[#f5f6fb] p-3"><h3 className="text-xs font-bold mb-2 flex items-center gap-2"><Focus size={14}/>Interactive screen controls</h3><ol className="list-decimal pl-4 space-y-1.5 text-xs">{targets.slice(0, 14).map((el, i) => <li key={i}><button type="button" onClick={() => focusTarget(el, i)} className="text-left underline decoration-dotted underline-offset-2">{targetLabel(el) || 'Unnamed control'}</button></li>)}</ol></div>}
      {pageText && <p className="sr-only">{pageText.slice(0, 1000)}</p>}
    </section>}
    <div className="flex items-center gap-1.5"><select aria-label="Quick language selector" value={language} onChange={e => setLanguage(e.target.value as Language)} className="max-w-[112px] rounded-full border border-white/70 bg-[#14183E] text-white shadow-xl px-2 py-3 text-[11px] font-bold"><option value="hi">हिन्दी</option><option value="hinglish">Hinglish</option><option value="en">English</option></select><button type="button" onClick={() => setOpen(v => !v)} aria-label="Open AI Mic and Speaker Guide" aria-expanded={open} className="rounded-full bg-[#14183E] text-white shadow-xl border-2 border-white p-3.5 flex items-center gap-2 font-bold text-xs"><Mic size={19}/><Volume2 size={18}/><span className="hidden sm:inline">AI Guide</span></button></div>
  </div>;
};
