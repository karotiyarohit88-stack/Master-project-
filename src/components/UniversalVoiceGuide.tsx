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
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideSummary, setGuideSummary] = useState('');
  const [guideSteps, setGuideSteps] = useState<Array<{ title: string; instruction: string; targetLabel: string }>>([]);
  const [guideNextAction, setGuideNextAction] = useState('');
  const [guideError, setGuideError] = useState('');
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [naturalVoiceEnabled, setNaturalVoiceEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userQuestion, setUserQuestion] = useState('');
  const [conversation, setConversation] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [posterBackground, setPosterBackground] = useState<string>('');
  const [posterTitle, setPosterTitle] = useState('AAKSH AI AUTOPILOT');
  const [posterSubtitle, setPosterSubtitle] = useState('Your personal AI workspace');
  const guideAbortRef = useRef<AbortController | null>(null);
  const speechGenerationRef = useRef(0);
  const recognitionRef = useRef<Recognition | null>(null);
  const voiceModeRef = useRef(false);
  const copy = COPY[language];

  useEffect(() => {
    try { localStorage.setItem('aaksh_voice_language', language); } catch { /* storage may be blocked */ }
    window.dispatchEvent(new CustomEvent('aaksh:language-change', { detail: language }));
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

  const speak = useCallback(async (text: string) => {
    const speechGeneration = ++speechGenerationRef.current;
    const cleanText = text.trim().slice(0, 3000);
    if (!cleanText) return;
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    audioRef.current = null;

    // External neural TTS is opt-in and asks for approval on every generation
    // because provider usage may consume a paid quota.
    if (naturalVoiceEnabled && window.confirm('Generate this speech with the configured ElevenLabs voice? Provider usage or charges may apply.')) {
      const voiceId = voiceGender === 'female' ? 'EXAVITQu4vr4xnSDxMaL' : 'ErXwobaYiN019PkySvjV';
      try {
        const response = await fetch('/api/video/generate-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ text: cleanText, voiceId, language })
        });
        const data = await response.json();
        if (response.ok && data.audioUrl) {
          const audio = new Audio(data.audioUrl);
          audioRef.current = audio;
          await audio.play();
          if (speechGeneration !== speechGenerationRef.current) { audio.pause(); return; }
          return;
        }
        setGuideError(data.error || 'Neural voice is not configured; using device voice instead.');
      } catch {
        setGuideError('Neural voice is unavailable; using device voice instead.');
      }
    }

    if (!('speechSynthesis' in window)) { setSpokenText(cleanText); return; }
    const voices = window.speechSynthesis.getVoices();
    const locale = language === 'hi' ? 'hi-IN' : 'en-IN';
    const preferred = voices.find(voice => voice.lang.toLowerCase().startsWith(language === 'hi' ? 'hi' : 'en')
      && (voiceGender === 'female' ? /female|woman|zira|samantha|susan|heera|kalpana/i.test(voice.name) : /male|man|david|mark|ravi|hemant/i.test(voice.name)));
    const fallback = voices.find(voice => voice.lang.toLowerCase().startsWith(language === 'hi' ? 'hi' : 'en'));
    const chunks = cleanText.match(/[^.!?।\\n]+[.!?।\\n]*/gu) || [cleanText];
    const queue = chunks.map(chunk => chunk.trim()).filter(Boolean);
    let chunkIndex = 0;
    const speakNext = () => {
      if (speechGeneration !== speechGenerationRef.current || chunkIndex >= queue.length) return;
      const utterance = new SpeechSynthesisUtterance(queue[chunkIndex++]);
      utterance.lang = locale;
      utterance.voice = preferred || fallback || null;
      utterance.rate = 0.99;
      utterance.pitch = voiceGender === 'female' ? 1.04 : 0.94;
      utterance.onend = () => {
        if (speechGeneration === speechGenerationRef.current) speakNext();
      };
      utterance.onerror = event => {
        if (event.error !== 'canceled' && event.error !== 'interrupted' && speechGeneration === speechGenerationRef.current) speakNext();
      };
      window.speechSynthesis.speak(utterance);
    };
    if (speechGeneration === speechGenerationRef.current) speakNext();
  }, [language, naturalVoiceEnabled, voiceGender]);

  const stopSpeech = useCallback(() => {
    speechGenerationRef.current += 1;
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current = null; }
  }, []);

  const interruptForInput = useCallback(() => {
    stopSpeech();
    guideAbortRef.current?.abort();
  }, [stopSpeech]);

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
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
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
    if (/^(stop|रोक|बंद|आवाज बंद)/u.test(command)) { interruptForInput(); voiceModeRef.current = false; setVoiceMode(false); return; }
    // Any new utterance while the assistant is speaking is a barge-in: stop playback first.
    interruptForInput();
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
    const fillMatch = raw.match(/^(?:type|fill|enter|लिखो|भरें)\s+(.+?)\s+(?:into|in|में)\s+(.+)$/iu);
    if (fillMatch) {
      const target = candidates.find(item => (item.element instanceof HTMLInputElement || item.element instanceof HTMLTextAreaElement) && normalizeVoiceText(item.label).includes(normalizeVoiceText(fillMatch[2])));
      if (!target) { setSpokenText('Matching input field not found.'); return; }
      const el = target.element as HTMLInputElement | HTMLTextAreaElement;
      if (el instanceof HTMLInputElement && ['password','hidden','file'].includes(el.type)) { setSpokenText('Sensitive fields cannot be filled by voice.'); return; }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus();
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
      setter?.call(el, fillMatch[1]);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      setSpokenText('Filled ' + (target.label || 'field') + '. Review before submitting.');
      speak('Filled the field. Please review it before submitting.');
      return;
    }
    const selectMatch = raw.match(/^(?:select|choose|चुनो)\s+(.+?)\s+(?:in|from|में)\s+(.+)$/iu);
    if (selectMatch) {
      const target = candidates.find(item => item.element instanceof HTMLSelectElement && normalizeVoiceText(item.label).includes(normalizeVoiceText(selectMatch[2])));
      if (!target || !(target.element instanceof HTMLSelectElement)) { setSpokenText('Matching dropdown not found.'); return; }
      const option = Array.from(target.element.options).find(item => normalizeVoiceText(item.text || item.label) === normalizeVoiceText(selectMatch[1]));
      if (!option) { setSpokenText('That option is not available in this dropdown.'); return; }
      target.element.value = option.value;
      target.element.dispatchEvent(new Event('change', { bubbles: true }));
      setSpokenText('Selected ' + option.text + '. Review before continuing.');
      speak('Selected ' + option.text + '.');
      return;
    }
    const candidate = findVoiceControl(command, candidates);
    const match = candidate?.element;
    if (!match) { setSpokenText(language === 'hi' ? 'यह command किसी सुरक्षित visible control से match नहीं हुई।' : 'No safe visible control matched that command.'); return; }
    if (match instanceof HTMLInputElement || match instanceof HTMLTextAreaElement) { match.focus(); match.scrollIntoView({ behavior: 'smooth', block: 'center' }); setSpokenText('Focused ' + (match.getAttribute('aria-label') || match.placeholder || match.name || 'input')); return; }
    if (match instanceof HTMLSelectElement) { match.focus(); setSpokenText('Dropdown focused. Say: select OPTION in FIELD.'); return; }
    if (candidate && isHighImpactVoiceAction(candidate) && !window.confirm(copy.confirm)) return;
    match.click();
    setSpokenText('Activated ' + (match.innerText || match.getAttribute('aria-label') || 'control'));
  }, [copy.confirm, getTargets, interruptForInput, language, readScreen, speak]);

  const createRecognition = useCallback((continuous: boolean) => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { setSpokenText(copy.noSpeech); return; }
    const recognition = new Ctor();
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.continuous = continuous;
    recognition.interimResults = false;
    recognition.onresult = event => { interruptForInput(); executeVoiceCommand(event.results?.[event.results.length - 1]?.[0]?.transcript || ''); };
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
  }, [copy.noSpeech, executeVoiceCommand, interruptForInput, language]);

  const startQuestionRecognition = () => {
    interruptForInput();
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { setSpokenText(copy.noSpeech); return; }
    const recognition = new Ctor();
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = event.results?.[event.results.length - 1]?.[0]?.transcript || '';
      if (transcript.trim()) void explainQuestion(transcript.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current?.stop();
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); }
    catch { setListening(false); setSpokenText(copy.noSpeech); }
  };

  const toggleVoiceMode = () => {
    if (voiceMode) { voiceModeRef.current = false; setVoiceMode(false); setSpokenText(copy.disabled); return; }
    if (!window.confirm(language === 'hi' ? 'Voice Command Mode microphone ko active rakhega jab tak aap ise OFF nahi karte. अनुमति दें?' : 'Enable continuous microphone listening until you turn Voice Command Mode off?')) return;
    setVoiceMode(true);
    voiceModeRef.current = true;
    createRecognition(true);
    setSpokenText(copy.enabled);
  };

  const explainQuestion = async (question: string) => {
    interruptForInput();
    const items = scanScreen();
    const main = document.querySelector('main') || document.querySelector('#root');
    const text = (main?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 6000);
    const labels = items.map(el => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.tagName).trim()).filter(Boolean);
    setGuideLoading(true); setGuideError(''); setGuideSteps([]);
    try {
      const controller = new AbortController();
      guideAbortRef.current = controller;
      const response = await fetch('/api/ai/page-guide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, credentials: 'same-origin',
        body: JSON.stringify({ page: document.title + ' ' + window.location.pathname, question, language, pageText: text, controls: labels, conversation: conversation.slice(-8) })
      });
      const data = await response.json();
      if (!response.ok || !data.guide) throw new Error(data.error || 'Page guide unavailable.');
      const guide = data.guide;
      setConversation(previous => [...previous, { role: 'user' as const, text: question }, { role: 'assistant' as const, text: [guide.summary, ...(guide.steps || []).map((step: any) => step.instruction), guide.nextAction].filter(Boolean).join(' ') }].slice(-12));
      setGuideSummary(guide.summary || '');
      setGuideSteps(Array.isArray(guide.steps) ? guide.steps : []);
      setGuideNextAction(guide.nextAction || '');
      const narration = [guide.summary, ...(guide.steps || []).map((step: any, index: number) => (index + 1) + '. ' + step.title + ': ' + step.instruction), guide.nextAction, guide.safetyNote].filter(Boolean).join(' ');
      setSpokenText(narration); speak(narration);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'AI page guide unavailable.';
      setGuideError(message); setSpokenText(message); speak(message);
    } finally { if (guideAbortRef.current?.signal.aborted || !guideAbortRef.current) setGuideLoading(false); else setGuideLoading(false); }
  };

  const submitQuestion = (event: React.FormEvent) => {
    event.preventDefault();
    const question = userQuestion.trim();
    if (!question) return;
    interruptForInput();
    setUserQuestion('');
    void explainQuestion(question);
  };

  const generatePosterBackground = () => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 420;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 1200, 420);
    gradient.addColorStop(0, '#14183E'); gradient.addColorStop(1, '#344078');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 420);
    for (let i = 0; i < 70; i++) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc((i * 173) % 1200, (i * 97) % 420, (i % 3) + 1, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 54px sans-serif'; ctx.fillText(posterTitle.slice(0, 34), 64, 185);
    ctx.font = '28px sans-serif'; ctx.fillText(posterSubtitle.slice(0, 65), 66, 245);
    setPosterBackground(canvas.toDataURL('image/jpeg', 0.88));
  };

  const loadPosterImage = (file?: File) => {
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) { setGuideError('Choose an image under 5 MB.'); return; }
    const reader = new FileReader(); reader.onload = () => setPosterBackground(String(reader.result || '')); reader.readAsDataURL(file);
  };

  const focusGuideTarget = (label: string, index: number) => {
    const wanted = normalizeVoiceText(label);
    const target = getTargets().find(el => normalizeVoiceText([el.innerText,el.getAttribute('aria-label'),el.getAttribute('placeholder'),el.getAttribute('name')].filter(Boolean).join(' ')).includes(wanted));
    if (target) focusTarget(target, index);
    else setSpokenText('No exact visible control matched this step; follow the instruction manually.');
  };

  useEffect(() => () => { voiceModeRef.current = false; recognitionRef.current?.stop(); guideAbortRef.current?.abort(); window.speechSynthesis?.cancel(); audioRef.current?.pause(); audioRef.current = null; }, []);

    const targetLabel = (el: HTMLElement) => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 90);

  const firstControlQuestion = targets[0] ? (language === 'hi' ? `इस control का उपयोग कैसे करें: ${targetLabel(targets[0])}?` : language === 'hinglish' ? `Is control ko kaise use karein: ${targetLabel(targets[0])}?` : `How do I use: ${targetLabel(targets[0])}?`) : copy.q3;
  const nextControlQuestion = targets.length ? (language === 'hi' ? `अगले control पर जाएँ: ${targetLabel(targets[1] || targets[0])}` : `Go to next control: ${targetLabel(targets[1] || targets[0])}`) : copy.q5;
  const actionQuestions = [copy.q1, copy.q2, firstControlQuestion, copy.q4, nextControlQuestion];

  return <div className="fixed z-[80] bottom-4 right-3 sm:right-5 flex flex-col items-end gap-2" aria-label="Universal voice and accessibility controls">
    {open && <section className="w-[min(92vw,390px)] max-h-[78dvh] overflow-y-auto rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-2xl p-4" aria-label={copy.title}>
      <div className="flex items-center justify-between gap-2 mb-3"><h2 className="font-bold text-sm">{copy.title}</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close voice guide" className="p-2 rounded-lg hover:bg-slate-100"><X size={17}/></button></div>
      <label className="block text-xs font-semibold mb-1">{copy.language}</label>
      <select aria-label="Choose voice language" value={language} onChange={e => setLanguage(e.target.value as Language)} className="w-full rounded-xl border border-slate-300 p-2.5 mb-3 text-sm"><option value="hi">हिन्दी</option><option value="hinglish">Hinglish</option><option value="en">English</option></select>
      <label className="block text-xs font-semibold mb-1">Speaker voice</label>
      <select aria-label="Choose speaker voice gender" value={voiceGender} onChange={e => setVoiceGender(e.target.value as 'female' | 'male')} className="w-full rounded-xl border border-slate-300 p-2.5 mb-2 text-sm"><option value="female">Female voice</option><option value="male">Male voice</option></select>
      <label className="flex items-center gap-2 text-xs mb-3"><input type="checkbox" checked={naturalVoiceEnabled} onChange={e => setNaturalVoiceEnabled(e.target.checked)} /> Use configured ElevenLabs neural voice (asks approval per use)</label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={readScreen} className="rounded-xl bg-[#14183E] text-white p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><Volume2 size={16}/>{copy.read}</button>
        <button type="button" onClick={stopSpeech} className="rounded-xl border border-slate-300 p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><VolumeX size={16}/>{copy.stop}</button>
        <button type="button" onClick={() => createRecognition(false)} className="rounded-xl bg-[#14183E] text-white p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><Mic size={16}/>{listening ? 'Listening…' : copy.listen}</button>
        <button type="button" onClick={() => setAccessibility(v => !v)} aria-pressed={accessibility} className="rounded-xl border border-slate-300 p-2.5 text-xs font-semibold flex items-center justify-center gap-2"><Accessibility size={16}/>{copy.accessibility}: {accessibility ? copy.on : copy.off}</button>
      </div>
      <button type="button" onClick={toggleVoiceMode} aria-pressed={voiceMode} className="w-full mt-2 rounded-xl border border-[#14183E] text-[#14183E] p-2.5 text-xs font-bold flex items-center justify-center gap-2"><ShieldCheck size={15}/>{copy.autopilot}: {voiceMode ? copy.on : copy.off}</button>
      <p className="text-[10px] text-slate-500 mt-2">Continuous listening is enabled only after explicit confirmation. It stops when you turn this mode off or leave the page. Critical actions still require confirmation.</p>
      <h3 className="text-xs font-bold mt-4 mb-2 flex items-center gap-2"><Sparkles size={14}/>{copy.questions}</h3>
      <div className="space-y-1.5">{actionQuestions.map(q => <button type="button" key={q} onClick={() => void explainQuestion(q)} className="w-full text-left rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2.5 text-xs flex items-center justify-between gap-2">{q}<ChevronRight size={14}/></button>)}</div>
      <form onSubmit={submitQuestion} className="mt-3 rounded-xl border border-slate-200 p-2.5" aria-label="Ask AAKSH a question">
        <label htmlFor="aaksh-guide-question" className="block text-xs font-bold mb-1">Apna sawaal poochhein / Ask me anything</label>
        <textarea id="aaksh-guide-question" value={userQuestion} onFocus={interruptForInput} onChange={e => setUserQuestion(e.target.value)} rows={2} maxLength={500} placeholder="Yahan type karein ya mic se poochhein…" className="w-full resize-y rounded-lg border border-slate-300 p-2 text-xs" />
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={startQuestionRecognition} className="flex-1 rounded-lg border border-slate-300 p-2 text-xs"><Mic size={14} className="inline mr-1"/> Ask by voice</button>
          <button type="submit" disabled={!userQuestion.trim() || guideLoading} className="flex-1 rounded-lg bg-[#14183E] text-white p-2 text-xs font-bold">Send question</button>
        </div>
      </form>
      <div className="mt-3 rounded-xl border border-slate-200 p-3">
        <h3 className="text-xs font-bold mb-2">Poster / Banner background</h3>
        <input aria-label="Poster title" value={posterTitle} onChange={e => setPosterTitle(e.target.value)} maxLength={34} className="w-full rounded-lg border p-2 text-xs mb-2" />
        <input aria-label="Poster subtitle" value={posterSubtitle} onChange={e => setPosterSubtitle(e.target.value)} maxLength={65} className="w-full rounded-lg border p-2 text-xs mb-2" />
        <div className="flex gap-2 flex-wrap"><button type="button" onClick={generatePosterBackground} className="rounded-lg bg-[#14183E] text-white px-3 py-2 text-xs">Generate navy banner</button><label className="rounded-lg border px-3 py-2 text-xs cursor-pointer">Upload background<input type="file" accept="image/*" className="sr-only" onChange={e => loadPosterImage(e.target.files?.[0])}/></label><button type="button" onClick={() => setPosterBackground('')} className="rounded-lg border px-3 py-2 text-xs">Remove</button></div>
        {posterBackground && <div className="mt-2 rounded-xl overflow-hidden border"><img src={posterBackground} alt="Generated message banner background" className="w-full max-h-28 object-cover"/><p className="p-2 text-[10px] text-slate-500">This background styles the guide response preview; it does not alter or obscure the original message.</p></div>}
      </div>
      {conversation.length > 0 && <div className="mt-3 space-y-2" aria-label="Recent guide conversation">{conversation.slice(-6).map((turn, i) => <div key={i} className={turn.role === 'user' ? 'ml-6 rounded-lg bg-slate-100 p-2 text-xs' : 'mr-3 rounded-lg border border-slate-200 p-2 text-xs'}><b>{turn.role === 'user' ? 'You' : 'AAKSH'}:</b> {turn.text}</div>)}</div>}
      <button type="button" onClick={scanScreen} className="mt-2 text-xs underline text-[#14183E]">Refresh screen controls</button>
      {guideLoading && <p role="status" className="mt-2 text-xs">AI is reviewing this screen…</p>}
      {guideError && <p role="alert" className="mt-2 text-xs text-red-700">{guideError}</p>}
      {guideSummary && <div className="mt-3 rounded-xl border border-[#14183E]/20 bg-[#f5f6fb] p-3" style={posterBackground ? { backgroundImage: `linear-gradient(rgba(255,255,255,.90),rgba(255,255,255,.90)),url(${posterBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><p className="text-xs font-semibold">{guideSummary}</p><ol className="mt-2 list-decimal pl-4 space-y-2">{guideSteps.map((step,i) => <li key={i} className="text-xs"><p className="font-bold">{step.title}</p><p>{step.instruction}</p>{step.targetLabel && <button type="button" onClick={() => focusGuideTarget(step.targetLabel,i)} className="mt-1 underline text-[#14183E]">Find: {step.targetLabel}</button>}</li>)}</ol>{guideNextAction && <p className="mt-2 text-xs font-bold">Next: {guideNextAction}</p>}<p className="mt-3 border-t border-slate-300 pt-2 text-xs font-semibold">{language === 'hi' ? 'क्या आपको यह समझ आ गया, या मैं आगे के विकल्प समझाऊँ?' : language === 'hinglish' ? 'Samajh aa gaya, ya main next options explain karun?' : 'Does that make sense, or should I explain the next options?'} </p><div className="flex gap-2 mt-2"><button type="button" onClick={() => void explainQuestion(language === 'hi' ? 'हाँ, अगला कदम और विकल्प समझाइए।' : 'Please explain the next options and step.')} className="rounded-lg bg-[#14183E] text-white px-3 py-2 text-xs">{language === 'hi' ? 'आगे समझाएँ' : 'Explain next'}</button><button type="button" onClick={stopSpeech} className="rounded-lg border px-3 py-2 text-xs">{language === 'hi' ? 'समझ आ गया' : 'Got it'}</button></div></div>}
      {spokenText && <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-2 text-xs">{spokenText}</p>}
      {targets.length > 0 && <div className="mt-3 rounded-xl border border-[#14183E]/20 bg-[#f5f6fb] p-3"><h3 className="text-xs font-bold mb-2 flex items-center gap-2"><Focus size={14}/>Interactive screen controls</h3><ol className="list-decimal pl-4 space-y-1.5 text-xs">{targets.slice(0, 14).map((el, i) => <li key={i}><button type="button" onClick={() => focusTarget(el, i)} className="text-left underline decoration-dotted underline-offset-2">{targetLabel(el) || 'Unnamed control'}</button></li>)}</ol></div>}
      {pageText && <p className="sr-only">{pageText.slice(0, 1000)}</p>}
    </section>}
    <div className="flex items-center gap-1.5"><select aria-label="Quick language selector" value={language} onChange={e => setLanguage(e.target.value as Language)} className="max-w-[112px] rounded-full border border-white/70 bg-[#14183E] text-white shadow-xl px-2 py-3 text-[11px] font-bold"><option value="hi">हिन्दी</option><option value="hinglish">Hinglish</option><option value="en">English</option></select><button type="button" onClick={() => setOpen(v => !v)} aria-label="Open AI Mic and Speaker Guide" aria-expanded={open} className="rounded-full bg-[#14183E] text-white shadow-xl border-2 border-white p-3.5 flex items-center gap-2 font-bold text-xs"><Mic size={19}/><Volume2 size={18}/><span className="hidden sm:inline">AI Guide</span></button></div>
  </div>;
};
