import React from 'react';
import { 
  Home,
  X, 
  Plus, 
  MessageSquare, 
  Trash2, 
  ShieldCheck, 
  Bot,
  Terminal,
  Compass,
  Share2,
  Cpu,
  GitBranch
} from 'lucide-react';
import { ConversationSession, AppView } from '../types';

interface ConversationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationSession[];
  activeId: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onOpenGitHub?: () => void;
  onSelectView?: (view: AppView) => void;
  activeView?: AppView;
}

export const ConversationDrawer: React.FC<ConversationDrawerProps> = ({
  isOpen,
  onClose,
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onOpenGitHub,
  onSelectView,
  activeView = 'home'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity cursor-pointer" 
        onClick={onClose}
        aria-label="Close sidebar backdrop"
      />

      {/* Drawer content */}
      <div className="relative w-[85vw] max-w-xs sm:max-w-sm h-full max-h-[100dvh] bg-white border-r border-slate-200 shadow-2xl flex flex-col z-10 animate-slide-right text-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white border border-emerald-200 p-0.5 flex items-center justify-center shadow-xs flex-shrink-0 overflow-hidden">
              <img src="/assets/aistudio/1791973196299_d0ac9fe0.png" alt="Master Project AI Agent Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm text-slate-900 truncate">Conversations</h2>
              <p className="text-[10px] text-emerald-800 font-mono font-medium truncate">Master Project AI Agent</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[38px] min-h-[38px] rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3 border-b border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-medium text-xs md:text-sm shadow-xs transition-all cursor-pointer min-h-[42px]"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span>New Chat</span>
          </button>
        </div>

        {/* GitHub Code Explorer Section in Sidebar */}
        <div className="p-2.5 sm:p-3 border-b border-slate-100 bg-slate-50/60 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>GitHub Code Explorer</span>
            </div>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-200 text-slate-700">
              Active
            </span>
          </div>

          <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
              <span className="truncate max-w-[170px] font-semibold text-slate-800">karotiyarohit88/...</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">main</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Read-only code viewer, full-text repo search & verified change staging.
            </p>
            {onOpenGitHub && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGitHub();
                }}
                className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Code Explorer</span>
                <span className="text-emerald-400">➔</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Navigation: Control Center Views (including Home and Audit Logs) */}
        {onSelectView && (
          <div className="p-2.5 sm:p-3 border-b border-slate-100 bg-white flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
              Control Center Navigation
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  onSelectView('home');
                  onClose();
                }}
                className={`p-2 rounded-xl flex items-center gap-1.5 text-left transition-colors cursor-pointer ${
                  activeView === 'home'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                }`}
              >
                <Home className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span className="truncate">Home</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectView('chat');
                  onClose();
                }}
                className={`p-2 rounded-xl flex items-center gap-1.5 text-left transition-colors cursor-pointer ${
                  activeView === 'chat'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span className="truncate">AI Chat</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectView('autopilot');
                  onClose();
                }}
                className={`p-2 rounded-xl flex items-center gap-1.5 text-left transition-colors cursor-pointer ${
                  activeView === 'autopilot'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span className="truncate">Auto Pilot</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectView('logs');
                  onClose();
                }}
                className={`p-2 rounded-xl flex items-center gap-1.5 text-left transition-colors cursor-pointer ${
                  activeView === 'logs'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span className="truncate">Audit Logs</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectView('connections');
                  onClose();
                }}
                className={`p-2 rounded-xl flex items-center gap-1.5 text-left transition-colors cursor-pointer ${
                  activeView === 'connections'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span className="truncate">Connections</span>
              </button>
            </div>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-emerald-100 min-h-0">
          {conversations.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-600" />
              No conversations yet. Start a new chat!
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeId;
              const date = new Date(conv.updatedAt);
              const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={conv.id}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-medium shadow-2xs'
                      : 'bg-white border-slate-200/70 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectConversation(conv.id);
                      onClose();
                    }}
                    className="flex-1 text-left min-w-0 pr-2 flex items-center gap-2 cursor-pointer"
                  >
                    <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{conv.title}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-mono">
                        <span>{conv.messages.length} msg{conv.messages.length !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>{formattedTime}</span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className="opacity-60 sm:opacity-40 sm:group-hover:opacity-100 p-2 min-w-[34px] min-h-[34px] rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
                    title="Delete conversation"
                    aria-label={`Delete conversation ${conv.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between flex-shrink-0">
          <span className="flex items-center gap-1 text-emerald-800 font-medium truncate">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="truncate">Master Project v1.0</span>
          </span>
          <span className="font-mono text-slate-400 flex-shrink-0 ml-1">Mobile Ready</span>
        </div>
      </div>
    </div>
  );
};
