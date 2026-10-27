import React from 'react';
import { 
  X, 
  HelpCircle, 
  Terminal, 
  CheckCircle2, 
  Bot 
} from 'lucide-react';

interface TestingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasApiKey: boolean;
  model: string;
}

export const TestingGuideModal: React.FC<TestingGuideModalProps> = ({
  isOpen,
  onClose,
  hasApiKey,
  model
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="fixed inset-0 -z-10 cursor-pointer"
        onClick={onClose}
        aria-label="Close dialog background"
      />
      <div className="relative w-full max-w-xl max-h-[90dvh] bg-white border border-slate-200 rounded-2xl shadow-2xl text-slate-800 flex flex-col overflow-hidden animate-fade-in">
        {/* Header - Fixed & Touch friendly */}
        <div className="bg-white/95 backdrop-blur-sm z-10 px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">Testing Guide</h3>
              <p className="text-[11px] text-slate-500 truncate">Preview instructions & verification checklist</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[38px] min-h-[38px] rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
            title="Close guide"
            aria-label="Close testing guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-3.5 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 text-xs sm:text-sm scrollbar-thin scrollbar-thumb-emerald-200">
          {/* Phase 1 Status & Transparency */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center justify-between mb-1.5 gap-2 min-w-0">
              <span className="font-mono font-semibold text-emerald-950 flex items-center gap-1.5 truncate">
                <Bot className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="truncate">Phase 1 Prototype Active</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold flex-shrink-0">
                ACTIVE
              </span>
            </div>
            <p className="text-slate-700 text-xs leading-relaxed">
              Clean mobile-responsive white and green chat application running with server-side Gemini API proxy (model: <code className="font-mono text-emerald-800 font-bold">{model}</code>).
            </p>
          </div>

          {/* What Works vs What Remains Incomplete */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="font-mono font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              Verified Capabilities vs Future Integrations
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                <span className="text-emerald-700 font-bold block mb-1">Working in Prototype:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-600 text-[11px]">
                  <li>Mobile-first single window chat</li>
                  <li>Modern white & green palette</li>
                  <li>Collapsible chat history sidebar</li>
                  <li>Suggested action prompt buttons</li>
                  <li>Task lifecycle status tracker</li>
                  <li>Safety gate & verification audit</li>
                  <li>Settings & density customization</li>
                </ul>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-amber-200">
                <span className="text-amber-800 font-bold block mb-1">Not Connected Yet:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-600 text-[11px]">
                  <li>Live Google web search index</li>
                  <li>Remote Cloud SQL database</li>
                  <li>User account login / auth</li>
                  <li>Telegram & n8n connectors</li>
                  <li>Payment processor webhooks</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Quick Testing Instructions */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="font-mono font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
              <Terminal className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              How to Test Right Now
            </span>
            <ol className="space-y-1 text-slate-600 text-[11px] sm:text-xs list-decimal pl-4">
              <li>Tap <strong className="text-emerald-800">Build UI</strong> to generate clean React code.</li>
              <li>Tap <strong className="text-amber-800">Safety Gate Test</strong> to test the <em>Waiting for Approval</em> flow.</li>
              <li>Tap <strong className="text-emerald-800">Create Agent</strong> to generate a worker agent specification.</li>
              <li>Tap the <strong className="text-slate-800">Settings</strong> icon to adjust font size or bubble density.</li>
              <li>Resize your preview window to Android mobile dimensions to test responsiveness.</li>
            </ol>
          </div>
        </div>

        {/* Modal Footer - Fixed */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm shadow-xs transition-all cursor-pointer min-h-[40px] flex items-center justify-center"
          >
            Start Testing
          </button>
        </div>
      </div>
    </div>
  );
};
