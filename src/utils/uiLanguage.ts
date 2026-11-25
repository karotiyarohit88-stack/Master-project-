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
    'Control Center Navigation': 'कंट्रोल सेंटर नेविगेशन',
    'What would you like to build or automate today?': 'आज आप क्या बनाना या ऑटोमेट करना चाहते हैं?',
    '+ New AI Chat': '+ नई AI चैट', 'Explore Code': 'कोड देखें',
    'Live System Health & Integration Status': 'लाइव सिस्टम स्वास्थ्य और इंटीग्रेशन स्थिति',
    'Core Backend': 'मुख्य बैकएंड', 'Backend available': 'बैकएंड उपलब्ध', 'Status unavailable': 'स्थिति उपलब्ध नहीं',
    'AI Model Engine': 'AI मॉडल इंजन', 'GitHub Explorer': 'GitHub एक्सप्लोरर',
    'n8n Automator': 'n8n ऑटोमेशन', 'Configured': 'कॉन्फ़िगर है', 'Local fallback': 'लोकल विकल्प',
    'Tasks & Approvals': 'कार्य और अनुमतियाँ', 'AI Command Center': 'AI कमांड सेंटर',
    'Quick Actions': 'त्वरित कार्य', 'Refresh status': 'स्थिति रीफ्रेश करें'
  },
  hinglish: {
    Home: 'Home', 'AI Chat': 'AI Chat', 'GitHub Explorer': 'GitHub Explorer', Analytics: 'Analytics',
    'AAKSH Workspace': 'AAKSH Workspace', 'Auto Pilot': 'Auto Pilot', 'Video Gen': 'Video Gen',
    'Voice Studio': 'Voice Studio', Publishing: 'Publishing', Connections: 'Connections',
    'Audit Logs': 'Audit Logs', 'Camera Studio': 'Camera Studio', Projects: 'Projects',
    Settings: 'Settings', Guide: 'Guide', 'New Chat': 'New Chat',
    'Open chat history': 'Chat history kholo', 'Start new chat': 'New chat shuru karein',
    'Interface Settings & Preferences': 'Interface settings aur preferences',
    'Control Center Navigation': 'Control Center Navigation',
    'What would you like to build or automate today?': 'Aaj aap kya build ya automate karna chahte hain?',
    '+ New AI Chat': '+ New AI Chat', 'Explore Code': 'Code explore karein',
    'Live System Health & Integration Status': 'Live system health aur integration status',
    'Core Backend': 'Core Backend', 'Backend available': 'Backend available', 'Status unavailable': 'Status unavailable',
    'AI Model Engine': 'AI Model Engine', 'n8n Automator': 'n8n Automator', 'Configured': 'Configured',
    'Local fallback': 'Local fallback', 'Tasks & Approvals': 'Tasks aur approvals',
    'AI Command Center': 'AI Command Center', 'Quick Actions': 'Quick Actions', 'Refresh status': 'Refresh status'
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
