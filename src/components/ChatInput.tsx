import React, { useRef, useEffect, useState } from 'react';
import { Send, XCircle, Image as ImageIcon, Camera, Mic, MicOff, Sparkles, HelpCircle, Play, Wrench, Eye, Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../types';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: (text: string, imageAttachment?: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  sendOnEnter?: boolean;
  selectedLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  onActionClick?: (actionType: 'help' | 'next_step' | 'run_task' | 'open_tools' | 'view_results') => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  isLoading,
  disabled,
  sendOnEnter = true,
  selectedLanguage = 'auto',
  onLanguageChange,
  onActionClick
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
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

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [setInput]);

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
        console.warn('Mic start error:', e);
      }
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

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
    if ((!input.trim() && !imagePreview) || isLoading || disabled) return;
    onSend(input, imagePreview || undefined);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sendOnEnter && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-2">
      {/* Quick Actions & Language Selector Toolbar */}
      {(onActionClick || onLanguageChange) && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {/* Language Selector Dropdown */}
          {onLanguageChange && (
            <div className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl px-2 py-0.5 text-emerald-900 font-medium text-[11px] flex-shrink-0 transition-colors">
              <Globe className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <select
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="bg-transparent text-emerald-900 font-bold focus:outline-none cursor-pointer py-0.5 text-[11px]"
                title="Select Language"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-white text-slate-800">
                    {lang.nativeLabel !== lang.label ? `${lang.label} (${lang.nativeLabel})` : lang.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {onActionClick && (
            <>
              <button
                type="button"
                onClick={() => onActionClick('help')}
                className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 font-medium transition-colors cursor-pointer flex items-center gap-1 flex-shrink-0 text-[11px]"
              >
                <HelpCircle className="w-3 h-3 text-emerald-600" />
                <span>Help Me</span>
              </button>

              <button
                type="button"
                onClick={() => onActionClick('next_step')}
                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium transition-colors cursor-pointer flex items-center gap-1 flex-shrink-0 text-[11px]"
              >
                <Play className="w-3 h-3 text-slate-600" />
                <span>Next Step</span>
              </button>

              <button
                type="button"
                onClick={() => onActionClick('run_task')}
                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors cursor-pointer flex items-center gap-1 flex-shrink-0 text-[11px] shadow-2xs"
              >
                <Sparkles className="w-3 h-3" />
                <span>Run Task</span>
              </button>

              <button
                type="button"
                onClick={() => onActionClick('open_tools')}
                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium transition-colors cursor-pointer flex items-center gap-1 flex-shrink-0 text-[11px]"
              >
                <Wrench className="w-3 h-3 text-slate-600" />
                <span>Open Tools</span>
              </button>

              <button
                type="button"
                onClick={() => onActionClick('view_results')}
                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium transition-colors cursor-pointer flex items-center gap-1 flex-shrink-0 text-[11px]"
              >
                <Eye className="w-3 h-3 text-slate-600" />
                <span>View Results</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Main Input Form Container */}
      <form onSubmit={handleSubmit} className="relative w-full max-w-full min-w-0">
        <div className="relative flex flex-col bg-white border border-slate-300 focus-within:border-emerald-500 focus-within:ring-3 focus-within:ring-emerald-500/15 rounded-2xl p-2 shadow-xs transition-all w-full min-w-0">
          
          {/* Image Thumbnail Preview if Attached */}
          {imagePreview && (
            <div className="relative inline-block mb-2 ml-1 max-w-[120px]">
              <img
                src={imagePreview}
                alt="Upload preview"
                className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5 hover:bg-rose-600 transition-colors"
                title="Remove attachment"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Textarea + Action Icons Bar */}
          <div className="flex items-end gap-1.5 min-w-0">
            {/* Hidden File Input for Gallery / Camera */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />

            {/* Gallery / Camera Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || disabled}
              className="p-2 text-slate-500 hover:text-emerald-600 transition-colors rounded-xl hover:bg-slate-50 cursor-pointer flex-shrink-0 mb-0.5"
              title="Attach Image or Photo"
            >
              <ImageIcon className="w-4.5 h-4.5" />
            </button>

            {/* Mic Toggle Button */}
            {speechSupported && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={isLoading || disabled}
                className={`p-2 transition-colors rounded-xl cursor-pointer flex-shrink-0 mb-0.5 ${
                  isListening 
                    ? 'bg-rose-100 text-rose-600 animate-pulse' 
                    : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-50'
                }`}
                title={isListening ? 'Stop Listening' : 'Voice Input'}
              >
                {isListening ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
              </button>
            )}

            {/* Text Input */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || disabled}
              placeholder={isListening ? 'Listening to voice...' : 'Ask Master Project AI Agent...'}
              rows={1}
              className="w-full resize-none bg-transparent text-slate-800 placeholder-slate-400 text-sm focus:outline-none py-1.5 px-1 max-h-28 leading-relaxed disabled:opacity-50 min-w-0"
            />

            {/* Clear Text button */}
            {input.length > 0 && !isLoading && (
              <button
                type="button"
                onClick={() => setInput('')}
                className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg mb-0.5 cursor-pointer flex-shrink-0"
                title="Clear text"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!input.trim() && !imagePreview) || isLoading || disabled}
              className="flex-shrink-0 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white shadow-2xs transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed mb-0.5"
              title="Send command"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-500 font-mono flex-wrap gap-1 min-w-0">
          <span className="truncate">
            {sendOnEnter ? 'Enter sends • Shift+Enter newline' : 'Tap Send button'}
          </span>
          <span className="text-emerald-700 font-medium flex-shrink-0">● White & Green UI</span>
        </div>
      </form>
    </div>
  );
};
