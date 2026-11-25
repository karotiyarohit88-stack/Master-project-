import { useEffect, useState } from 'react';

export type UiLanguage = 'hi' | 'hinglish' | 'en';
const dictionary: Record<UiLanguage, Record<string, string>> = {
  hi: {
    Home: 'होम', 'AI Chat': 'AI चैट', 'GitHub Explorer': 'GitHub एक्सप्लोरर', Analytics: 'एनालिटिक्स',
    'AAKSH Workspace': 'AAKSH कार्यक्षेत्र', 'Auto Pilot': 'ऑटोपायलट', 'Video Gen': 'वीडियो जनरेशन',
    'Voice Studio': 'वॉइस स्टूडियो', Publishing: 'प्रकाशन', Connections: 'कनेक्शन',
    'Audit Logs': 'ऑडिट लॉग', 'Camera Studio': 'कैमरा स्टूडियो', Projects: 'प्रोजेक्ट',
    Settings: 'सेटिंग्स', Guide: 'गाइड', 'New Chat': 'नई चैट',
    'Open chat history': 'चैट इतिहास खोलें', 'Start new chat': 'नई चैट शुरू करें',
    'Interface Settings & Preferences': 'इंटरफेस सेटिंग्स और प्राथमिकताएं',
    'Control Center Navigation': 'कंट्रोल सेंटर नेविगेशन'
  },
  hinglish: {
    Home: 'Home', 'AI Chat': 'AI Chat', 'GitHub Explorer': 'GitHub Explorer', Analytics: 'Analytics',
    'AAKSH Workspace': 'AAKSH Workspace', 'Auto Pilot': 'Auto Pilot', 'Video Gen': 'Video Gen',
    'Voice Studio': 'Voice Studio', Publishing: 'Publishing', Connections: 'Connections',
    'Audit Logs': 'Audit Logs', 'Camera Studio': 'Camera Studio', Projects: 'Projects',
    Settings: 'Settings', Guide: 'Guide', 'New Chat': 'New Chat',
    'Open chat history': 'Chat history kholo', 'Start new chat': 'New chat shuru karein',
    'Interface Settings & Preferences': 'Interface settings aur preferences',
    'Control Center Navigation': 'Control Center Navigation'
  },
  en: {}
};

export function useUiLanguage(): UiLanguage {
  const read = (): UiLanguage => {
    try {
      const value = localStorage.getItem('aaksh_voice_language');
      return value === 'hi' || value === 'hinglish' || value === 'en' ? value : 'en';
    } catch { return 'en'; }
  };
  const [language, setLanguage] = useState<UiLanguage>(read);
  useEffect(() => {
    const update = (event?: Event) => {
      const detail = (event as CustomEvent<UiLanguage> | undefined)?.detail;
      setLanguage(detail === 'hi' || detail === 'hinglish' || detail === 'en' ? detail : read());
    };
    window.addEventListener('aaksh:language-change', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('aaksh:language-change', update); window.removeEventListener('storage', update); };
  }, []);
  return language;
}

export function translateUi(key: string, language: UiLanguage): string {
  return dictionary[language][key] || key;
}
