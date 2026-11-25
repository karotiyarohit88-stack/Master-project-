import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Volume2, VolumeX, Languages, Sparkles, X, Accessibility, Camera, ChevronRight } from 'lucide-react';

type Language = 'hi' | 'hinglish' | 'en';
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: any) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
declare global { interface Window { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition } }

const COPY = {
  hi: { title: 'AI Mic & Speaker Guide', read: 'पूरी स्क्रीन पढ़ें', stop: 'आवाज़ रोकें', listen: 'आवाज़ से कमांड', questions: 'स्मार्ट सवाल', accessibility: 'Accessibility Mode', autopilot: 'Voice Command Mode', on: 'चालू', off: 'बंद', language: 'भाषा', q: ['यहाँ हम क्या-क्या काम कर सकते हैं?', 'अगला कदम क्या है?', 'इस पेज की सेटिंग कैसे करें?', 'इस स्क्रीन के बटन समझाएँ।', 'मुझे सुरक्षित तरीके से आगे बढ़ाएँ।'], help: 'इस स्क्रीन पर उपलब्ध मुख्य विकल्प और उनके अगले कदम नीचे दिए गए हैं।', noSpeech: 'इस ब्राउज़र में voice recognition उपलब्ध नहीं है।' },
  hinglish: { title: 'AI Mic & Speaker Guide', read: 'Full screen read karo', stop: 'Voice stop karo', listen: 'Voice command', questions: 'Smart questions', accessibility: 'Accessibility Mode', autopilot: 'Voice Command Mode', on: 'ON', off: 'OFF', language: 'Language', q: ['Yahan kya-kya kaam kar sakte hain?', 'Next step kya hai?', 'Is page ki setting kaise karein?', 'Screen ke buttons samjhao.', 'Mujhe safe tareeke se guide karo.'], help: 'Is screen ke main options aur unke next steps neeche diye gaye hain.', noSpeech: 'Is browser mein voice recognition available nahi hai.' },
  en: { title: 'AI Mic & Speaker Guide', read: 'Read full screen', stop: 'Stop speaking', listen: 'Voice commands', questions: 'Smart questions', accessibility: 'Accessibility Mode', autopilot: 'Voice Command Mode', on: 'ON', off: 'OFF', language: 'Language', q: ['What can I do on this screen?', 'What is the next step?', 'How do I configure this page?', 'Explain the buttons on this screen.', 'Guide me through the safe next step.'], help: 'The main options on this screen and their next steps are listed below.', noSpeech: 'Speech recognition is unavailable in this browser.' }
};

const NAV_NAMES = ['Home', 'AI Chat', 'GitHub Explorer', 'Analytics', 'AAKSH Workspace', 'Auto Pilot', 'Video Gen', 'Voice Studio', 'Publishing', 'Connections', 'Audit Logs', 'Camera Studio'];

export const UniversalVoiceGuide: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('aaksh_voice_language') as Language) || 'hi');
  const [accessibility, setAccessibility] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [guideSteps, setGuideSteps] = useState<string[]>([]);
  const recognitionRef = useRef<Recognition | null>(null);
  const copy = COPY[language];

  useEffect(() => { localStorage.setItem('aaksh_voice_language', language); document.documentElement.lang = language === 'hi' ? 'hi' : 'en'; }, [language]);

  const visibleElements = () => Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2, main h3, main button, main label, main input, main select, main textarea, form button, header nav button'))
    .filter(el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length))
    .slice(0, 45);

  const readScreen = () => {
    const main = document.querySelector('main') || document.querySelector('#root');
    const text = (main?.innerText || document.body.innerText).replace(/\\s+/g, ' ').slice(0, 7000);
    const intro = language === 'hi' ? 'मैं इस स्क्रीन को सरल भाषा में पढ़ रहा हूँ। ' : language === 'hinglish' ? 'Main is screen ko simple words mein read kar raha hoon. ' : 'I am reading this screen in simple language. ';
    setSpokenText(text.slice(0, 500));
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(intro + text);
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = 0.94;
      window.speechSynthesis.speak(utterance);
    }
    const items = visibleElements();
    setGuideSteps(items.slice(0, 8).map((el, i) => {
      const label = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.tagName).trim().slice(0, 100);
      return (i + 1) + '. ' + label;
    }));
  };

  const explainQuestion = (question: string) => {
    const elements = visibleElements();
    const labels = elements.map(el => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName).trim()).filter(Boolean).slice(0, 8);
    const steps = [question, copy.help, ...labels.map((label, i) => (i + 1) + '. ' + label), language === 'hi' ? 'किसी भी बाहरी प्रभाव वाले काम से पहले पुष्टि करें।' : 'Confirm before any action with external impact.'];
    setGuideSteps(steps);
    const text = steps.join('. ');
    setSpokenText(text);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCommand = (raw: string) => {
    const command = raw.toLowerCase().trim();
    if (/stop (reading|speaking)|आवाज़ बंद|रोक/.test(command)) { window.speechSynthesis?.cancel(); return; }
    if (/read (the )?screen|screen reader on|स्क्रीन पढ़|screen read/.test(command)) { setAccessibility(true); readScreen(); return; }
    if (/accessibility mode on|accessibility चालू/.test(command)) { setAccessibility(true); return; }
    if (/accessibility mode off|accessibility बंद/.test(command)) { setAccessibility(false); return; }
    if (/voice autopilot on|voice command mode on|वॉइस ऑटोपायलट चालू/.test(command)) {
      if (window.confirm(language === 'hi' ? 'Voice Command Mode चालू करें? यह केवल सुरक्षित navigation और read commands चलाएगा।' : 'Enable Voice Command Mode? It will only run safe navigation and read commands.')) setVoiceMode(true);
      return;
    }
    if (/voice autopilot off|voice command mode off|वॉइस ऑटोपायलट बंद/.test(command)) { setVoiceMode(false); return; }
    if (voiceMode) {
      const target = NAV_NAMES.find(name => command.includes(name.toLowerCase()));
      if (target) {
        const button = Array.from(document.querySelectorAll('header nav button')).find(el => (el.textContent || '').toLowerCase().includes(target.toLowerCase())) as HTMLButtonElement | undefined;
        if (button) { button.click(); setSpokenText('Opening ' + target); }
      }
      if (/home|होम/.test(command)) (document.querySelector('header nav button') as HTMLButtonElement | null)?.click();
    }
  };

  const startListening = () => {
    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) { setSpokenText(copy.noSpeech); return; }
    recognitionRef.current?.stop();
    const recognition = new RecognitionCtor();
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setSpokenText(transcript);
      handleCommand(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    try { recognition.start(); } catch { setListening(false); }
  };

  useEffect(() => () => { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  return <div className="fixed z-[80] bottom-4 right-3 sm:right-5 flex flex-col items-end gap-2" aria-label="Universal voice and accessibility controls">
    {open && <section className="w-[min(92vw,370px)] max-h-[75dvh] overflow-y-auto rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-2xl p-4" aria-label={copy.title}>
      <div className="flex items-center justify-between gap-2 mb-3"><h2 className="font-bold text-sm">{copy.title}</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close voice guide" className="p-2 rounded-lg hover:bg-slate-100"><X size={17}/></button></div>
      <label className="block text-xs font-semibold mb-1">{copy.language}</label>
      <select aria-label="Choose voice language" value={language} onChange={e => setLanguage(e.target.value as Language)} className="w-full rounded-xl border border-slate-300 p-2.5 mb-3 text-sm">
        <option value="hi">हिन्दी</option><option value="hinglish">Hinglish</option><option value="en">English</option>
      </select>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={readScreen} className="rounded-xl bg-[#14183E] text-white p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><Volume2 size={16}/>{copy.read}</button>
        <button type="button" onClick={() => window.speechSynthesis?.cancel()} className="rounded-xl border border-slate-300 p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><VolumeX size={16}/>{copy.stop}</button>
        <button type="button" onClick={startListening} className="rounded-xl bg-[#14183E] text-white p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><Mic size={16}/>{listening ? 'Listening…' : copy.listen}</button>
        <button type="button" onClick={() => setAccessibility(v => !v)} aria-pressed={accessibility} className="rounded-xl border border-slate-300 p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><Accessibility size={16}/>{copy.accessibility}: {accessibility ? copy.on : copy.off}</button>
      </div>
      <button type="button" onClick={() => setVoiceMode(v => !v)} aria-pressed={voiceMode} className="w-full mt-2 rounded-xl border border-[#14183E] text-[#14183E] p-2.5 text-xs font-bold">{copy.autopilot}: {voiceMode ? copy.on : copy.off}</button>
      <p className="text-[10px] text-slate-500 mt-2">Voice listens only after you tap the mic. Commands are not active in the background. External, destructive and publishing actions still require normal approval.</p>
      <h3 className="text-xs font-bold mt-4 mb-2 flex items-center gap-2"><Sparkles size={14}/>{copy.questions}</h3>
      <div className="space-y-1.5">{copy.q.map(q => <button type="button" key={q} onClick={() => explainQuestion(q)} className="w-full text-left rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2.5 text-xs flex items-center justify-between gap-2">{q}<ChevronRight size={14}/></button>)}</div>
      {spokenText && <p role="status" className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-2 text-xs">{spokenText}</p>}
      {guideSteps.length > 0 && <div className="mt-3 rounded-xl border border-[#14183E]/20 bg-[#f5f6fb] p-3"><h3 className="text-xs font-bold mb-2">Step-by-step guide</h3><ol className="list-decimal pl-4 space-y-1 text-xs">{guideSteps.map((step, i) => <li key={i}>{step}</li>)}</ol></div>}
    </section>}
    <button type="button" onClick={() => setOpen(v => !v)} aria-label="Open AI Mic and Speaker Guide" aria-expanded={open} className="rounded-full bg-[#14183E] text-white shadow-xl border-2 border-white p-3.5 flex items-center gap-2 font-bold text-xs"><Mic size={19}/><Volume2 size={18}/><span className="hidden sm:inline">AI Guide</span></button>
  </div>;
};
