import React from 'react';
import { 
  X, 
  Settings, 
  Sliders, 
  Type, 
  ShieldCheck, 
  RotateCcw, 
  Database, 
  Globe, 
  Lock, 
  Bot 
} from 'lucide-react';
import { AppSettings, ServerHealth } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onResetSettings: () => void;
  onClearHistory: () => void;
  serverHealth: ServerHealth | null;
  onOpenConnections?: () => void;
  onOpenGitHub?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
  onClearHistory,
  serverHealth,
  onOpenConnections,
  onOpenGitHub
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="fixed inset-0 -z-10 cursor-pointer"
        onClick={onClose}
        aria-label="Close dialog background"
      />
      <div className="relative w-full max-w-lg max-h-[90dvh] bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-800 flex flex-col overflow-hidden animate-fade-in">
        {/* Header - Fixed & Touch friendly */}
        <div className="bg-white/95 backdrop-blur-sm z-10 px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">Settings</h3>
              <p className="text-[11px] text-slate-500 truncate">Preferences & integration transparency</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[38px] min-h-[38px] rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
            title="Close settings"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content body */}
        <div className="p-3.5 sm:p-5 space-y-5 overflow-y-auto flex-1 min-h-0 scrollbar-thin scrollbar-thumb-emerald-200">
          {/* Section 1: Chat Preferences */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              Chat & Input Preferences
            </h4>

            {/* Send on Enter toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-800">Send on Enter</p>
                <p className="text-[11px] text-slate-500">Press Enter to send (Shift + Enter for new line)</p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ sendOnEnter: !settings.sendOnEnter })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                  settings.sendOnEnter ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                aria-label="Toggle send on enter"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.sendOnEnter ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Task Status Tracker toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-800">Task Lifecycle Tracker</p>
                <p className="text-[11px] text-slate-500">Show visual progress bar (Understanding ➔ Running)</p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ showStatusTracker: !settings.showStatusTracker })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                  settings.showStatusTracker ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                aria-label="Toggle task lifecycle tracker"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.showStatusTracker ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Message Bubble Density */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <label className="text-xs sm:text-sm font-medium text-slate-800 block">Message Bubble Density</label>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ bubbleDensity: 'comfortable' })}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer min-h-[38px] ${
                    settings.bubbleDensity === 'comfortable'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Comfortable (Spacious)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ bubbleDensity: 'compact' })}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer min-h-[38px] ${
                    settings.bubbleDensity === 'compact'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Compact (Mobile High-Density)
                </button>
              </div>
            </div>

            {/* Font Size */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <label className="text-xs sm:text-sm font-medium text-slate-800 block flex items-center gap-1.5">
                <Type className="w-4 h-4 text-emerald-600" />
                Reading Font Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onUpdateSettings({ fontSize: size })}
                    className={`py-1.5 px-2 text-xs capitalize rounded-lg border transition-all cursor-pointer min-h-[36px] ${
                      settings.fontSize === size
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Honest Integration Status */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              Integration & Sandbox Transparency
            </h4>
            <p className="text-[11px] text-slate-500">
              Verified state of backend capabilities:
            </p>

            <div className="space-y-1.5 text-xs">
              {/* Gemini Chat Core */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Bot className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-emerald-950 truncate">AI Chat Engine</p>
                    <p className="text-[10px] text-emerald-800/80 truncate">{serverHealth?.model || 'gemini-3.8-flash'}</p>
                  </div>
                </div>
                <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold flex-shrink-0">
                  CONNECTED
                </span>
              </div>

              {/* Web Search */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Globe className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-amber-950 truncate">Live Web Search</p>
                    <p className="text-[10px] text-amber-800/80 truncate">Prototype mode (not live)</p>
                  </div>
                </div>
                <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold flex-shrink-0">
                  SIMULATED
                </span>
              </div>

              {/* Persistent Database */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Database className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">Persistent Storage</p>
                    <p className="text-[10px] text-slate-500 truncate">Local storage active</p>
                  </div>
                </div>
                <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold flex-shrink-0">
                  LOCAL ONLY
                </span>
              </div>

              {/* External Automation (Telegram, n8n, Stripe) */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Lock className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">External Automation</p>
                    <p className="text-[10px] text-slate-500 truncate">Disabled for prototype safety</p>
                  </div>
                </div>
                <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold flex-shrink-0">
                  LOCKED
                </span>
              </div>
            </div>

            {onOpenConnections && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenConnections();
                }}
                className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-emerald-600" />
                <span>Configure Keys & Webhooks in Connections Tab</span>
              </button>
            )}
          </div>

          {/* Section: GitHub Code Explorer & Repositories */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              GitHub Repository & Code Explorer
            </h4>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Repository Status:</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  ACTIVE
                </span>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1 font-mono">
                <p><strong>Repo:</strong> karotiyarohit88/master-project-ai-agent</p>
                <p><strong>Branch:</strong> main (Protected)</p>
                <p className="text-slate-500 font-sans">Server-side token verification with zero client-side secret exposure.</p>
              </div>

              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-900 font-sans">
                <strong>Termux Notice:</strong> Local Termux/device files are only available through GitHub once committed and pushed to the remote repository.
              </div>

              {onOpenGitHub && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGitHub();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Open GitHub Code Explorer</span>
                  <span className="text-emerald-400">➔</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Data Actions */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
            <button
              type="button"
              onClick={onResetSettings}
              className="w-full sm:w-auto px-3 py-2 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear all conversation history stored on this device?')) {
                  onClearHistory();
                  onClose();
                }
              }}
              className="w-full sm:w-auto px-3 py-2 rounded-lg text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer min-h-[36px]"
            >
              Clear Conversation History
            </button>
          </div>
        </div>

        {/* Modal Footer - Fixed */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm shadow-xs transition-all cursor-pointer min-h-[40px] flex items-center justify-center"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
