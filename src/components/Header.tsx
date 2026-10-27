import React from 'react';
import { 
  Home,
  Bot, 
  Plus, 
  Menu, 
  HelpCircle, 
  Settings,
  Compass,
  Film,
  Mic,
  Share2,
  Cpu,
  Terminal,
  GitBranch,
  BarChart3
} from 'lucide-react';
import { ServerHealth, AppView } from '../types';

interface HeaderProps {
  onOpenDrawer: () => void;
  onNewChat: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  conversationCount: number;
  serverHealth: ServerHealth | null;
  activeView: AppView;
  onSelectView: (view: AppView) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenDrawer,
  onNewChat,
  onOpenGuide,
  onOpenSettings,
  conversationCount,
  serverHealth,
  activeView,
  onSelectView
}) => {
  const navTabs: { id: AppView; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'chat', label: 'AI Chat', icon: Bot },
    { id: 'github', label: 'GitHub Explorer', icon: GitBranch },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'autopilot', label: 'Auto Pilot', icon: Compass },
    { id: 'video', label: 'Video Gen', icon: Film },
    { id: 'voice', label: 'Voice Studio', icon: Mic },
    { id: 'publishing', label: 'Publishing', icon: Share2 },
    { id: 'connections', label: 'Connections', icon: Cpu },
    { id: 'logs', label: 'Audit Logs', icon: Terminal },
  ];

  return (
    <header className="sticky top-0 z-40 w-full max-w-full bg-white/95 backdrop-blur-md border-b border-slate-200 px-2.5 sm:px-4 md:px-6 py-1.5 shadow-2xs">
      <div className="max-w-6xl mx-auto flex flex-col gap-1.5 w-full min-w-0">
        
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 w-full min-w-0">
          {/* Left: Sidebar toggle & Title */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={onOpenDrawer}
              className="p-2 min-w-[38px] min-h-[38px] rounded-xl text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-colors relative flex items-center justify-center cursor-pointer flex-shrink-0"
              title="Open chat history"
              aria-label="Open chat history"
            >
              <Menu className="w-4 h-4" />
              {conversationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-[9px] font-mono text-white flex items-center justify-center font-bold shadow-xs">
                  {conversationCount}
                </span>
              )}
            </button>

            <div 
              onClick={() => onSelectView('home')}
              className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
            >
              <img 
                src="/assets/aistudio/1791973196299_d0ac9fe0.png" 
                alt="Master Project Logo" 
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-emerald-500 shadow-xs flex-shrink-0" 
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="font-bold text-xs sm:text-sm md:text-base text-slate-900 truncate">
                    Master Project AI Agent
                  </h1>
                  <span className="hidden md:inline-flex text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold flex-shrink-0">
                    Techar Aaksh
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono hidden xs:block truncate">
                  Techar Aaksh AI Control Center
                </p>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            {/* Settings button */}
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 min-w-[38px] min-h-[38px] rounded-xl text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-xs transition-colors flex items-center justify-center cursor-pointer"
              title="Interface Settings & Preferences"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Guide & testing button */}
            <button
              type="button"
              onClick={onOpenGuide}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 min-h-[38px] rounded-xl text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-xs transition-colors cursor-pointer"
              title="Testing guide"
              aria-label="Testing guide"
            >
              <HelpCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="hidden md:inline font-medium">Guide</span>
            </button>

            {/* New Chat Button */}
            <button
              type="button"
              onClick={() => {
                onSelectView('chat');
                onNewChat();
              }}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium text-xs shadow-xs transition-all cursor-pointer"
              title="Start new chat"
              aria-label="Start new chat"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden xs:inline">New Chat</span>
            </button>
          </div>
        </div>

        {/* Bottom: Control Center Module Navigation Tabs (Responsive & Touch Friendly) */}
        <nav 
          aria-label="Control Center Navigation"
          className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-1 -mx-1 px-1 min-w-0"
        >
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectView(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 min-h-[34px] ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-emerald-900 hover:bg-emerald-50/70 bg-slate-50 border border-slate-200/70'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-emerald-700'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

      </div>
    </header>
  );
};
