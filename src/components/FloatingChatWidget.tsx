import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  Maximize2, 
  Minimize2,
  ImageIcon, 
  Mic, 
  MicOff, 
  XCircle, 
  ShieldCheck,
  Play,
  HelpCircle,
  Wrench,
  Eye,
  Sparkles,
  Globe,
  Plus
} from 'lucide-react';
import { ChatMessageItem, AppSettings, AppView, SUPPORTED_LANGUAGES } from '../types';
import { ChatMessage } from './ChatMessage';

interface FloatingChatWidgetProps {
  currentMessages: ChatMessageItem[];
  onSendMessage: (text: string, imageAttachment?: string) => void;
  isLoading: boolean;
  onOpenFullChat: () => void;
  onNewChat?: () => void;
  onNavigateToView?: (view: AppView) => void;
  settings?: AppSettings;
  selectedLanguage?: string;
  onLanguageChange?: (lang: string) => void;
}

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({
  currentMessages,
  onSendMessage,
  isLoading,
  onOpenFullChat,
  onNewChat,
  onNavigateToView,
  settings,
  selectedLanguage = 'auto',
  onLanguageChange
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition if supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) setInput(transcript);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.warn('Mic error:', e);
      }
    }
  };

  // Auto-scroll messages in floating overlay
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, currentMessages, isLoading]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !imagePreview) || isLoading) return;
    onSendMessage(input, imagePreview || undefined);
    setInput('');
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      {/* Floating Help Chat Button (Green Circle with Speech Bubble & Question Mark) */}
      <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative group w-16 h-16 sm:w-18 sm:h-18 bg-[#0b7a3e] hover:bg-[#086332] text-white rounded-full flex flex-col items-center justify-center shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer border-2 border-white p-1 select-none"
          title="Open Help Chat"
          aria-label="Open Help Chat"
        >
          {/* Question mark inside speech bubble */}
          <div className="relative flex items-center justify-center">
            <HelpCircle className="w-8 h-8 sm:w-9 sm:h-9 text-white stroke-[2.2]" />
          </div>
          <span className="text-[10px] sm:text-[11px] font-bold text-white tracking-tight leading-none mt-0.5">
            Help Chat
          </span>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full" />
        </button>
      </div>

      {/* Floating Help Chat Window Overlay / Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-50 shadow-2xl z-50 flex flex-col border-l border-slate-200 text-slate-800 overflow-hidden animate-in slide-in-from-right duration-200">
          
          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-[#0b7a3e] text-white flex justify-between items-center shadow-xs flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white p-0.5 border border-emerald-300 flex-shrink-0">
                <img 
                  src="/assets/aistudio/1791973196299_d0ac9fe0.png" 
                  className="w-full h-full object-cover rounded-full" 
                  alt="Master AI Agent Avatar" 
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm truncate">Help Chat — Master AI Agent</h3>
                <p className="text-[10px] text-emerald-100 font-mono truncate">Techar Aaksh • Live Execution & Outputs</p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              {/* New Chat Button */}
              {onNewChat && (
                <button
                  type="button"
                  onClick={onNewChat}
                  className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Start New Chat"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New</span>
                </button>
              )}

              {/* Expand to Full Chat View */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenFullChat();
                }}
                className="p-1.5 hover:bg-emerald-700/80 rounded-lg transition-colors cursor-pointer text-emerald-100 hover:text-white"
                title="Expand Full Screen Chat"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              {/* Close Floating Window */}
              <button 
                type="button"
                onClick={() => setIsOpen(false)} 
                className="p-1.5 hover:bg-emerald-700/80 rounded-lg transition-colors cursor-pointer text-emerald-100 hover:text-white"
                title="Close Help Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sub Header Notice & Language Selector */}
          <div className="bg-emerald-50 border-b border-emerald-200/80 px-3 py-1.5 text-[11px] text-emerald-900 flex items-center justify-between font-mono flex-shrink-0 gap-2">
            {onLanguageChange ? (
              <div className="flex items-center gap-1 bg-white border border-emerald-300 rounded-lg px-2 py-0.5 text-emerald-900 font-medium text-[11px] truncate">
                <Globe className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <select
                  value={selectedLanguage}
                  onChange={(e) => onLanguageChange(e.target.value)}
                  className="bg-transparent text-emerald-900 font-bold focus:outline-none cursor-pointer py-0.5 text-[11px]"
                  title="Select Language"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-white text-slate-800 font-sans">
                      {lang.nativeLabel !== lang.label ? `${lang.label} (${lang.nativeLabel})` : lang.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="truncate">Type commands to run workflows or query AI agent</span>
            )}
            <span className="font-bold text-emerald-700 flex-shrink-0">● Active</span>
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-0">
            {currentMessages.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-600" />
                Ask questions, generate posters, or type commands to start...
              </div>
            ) : (
              currentMessages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onApproveAction={() => {}}
                  onRejectAction={() => {}}
                  settings={settings}
                  onNavigateToView={onNavigateToView}
                />
              ))
            )}

            {isLoading && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-emerald-200 text-xs font-mono text-slate-600 shadow-2xs animate-pulse">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Master Agent processing request...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input & Image Preview Footer */}
          <div className="p-3 border-t border-slate-200 bg-white space-y-2 flex-shrink-0">
            
            {/* Image Preview if attached */}
            {imagePreview && (
              <div className="relative inline-block max-w-[90px]">
                <img
                  src={imagePreview}
                  alt="Upload preview"
                  className="w-14 h-14 object-cover rounded-xl border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5 hover:bg-rose-600"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
              <input 
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="p-2 text-slate-500 hover:text-emerald-600 transition-colors rounded-xl hover:bg-slate-100 cursor-pointer flex-shrink-0"
                title="Attach photo"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={isLoading}
                  className={`p-2 transition-colors rounded-xl cursor-pointer flex-shrink-0 ${
                    isListening ? 'bg-rose-100 text-rose-600 animate-pulse' : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100'
                  }`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}

              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder={isListening ? 'Listening...' : 'Ask AI or type command...'} 
                className="flex-1 border border-slate-300 rounded-full px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500 bg-slate-50 font-sans"
              />

              <button 
                type="submit"
                disabled={(!input.trim() && !imagePreview) || isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-full text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex-shrink-0"
              >
                Send
              </button>
            </form>
          </div>

        </div>
      )}
    </>
  );
};
