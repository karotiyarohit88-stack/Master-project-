import React from 'react';
import { 
  Home, 
  Bot, 
  GitBranch, 
  Compass, 
  Settings 
} from 'lucide-react';
import { AppView } from '../types';

interface BottomNavigationProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  onOpenSettings: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeView,
  onSelectView,
  onOpenSettings
}) => {
  const items = [
    { id: 'home' as AppView, label: 'Home', icon: Home, isSettings: false },
    { id: 'chat' as AppView, label: 'AI Chat', icon: Bot, isSettings: false },
    { id: 'github' as AppView, label: 'Projects', icon: GitBranch, isSettings: false },
    { id: 'autopilot' as AppView, label: 'Auto Pilot', icon: Compass, isSettings: false },
    { id: 'settings' as AppView, label: 'Settings', icon: Settings, isSettings: true }
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="sticky bottom-0 z-40 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 shadow-lg"
    >
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = !item.isSettings && activeView === item.id;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.isSettings) {
                  onOpenSettings();
                } else {
                  onSelectView(item.id);
                }
              }}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all cursor-pointer min-w-[56px] min-h-[48px] relative ${
                isActive
                  ? 'text-emerald-700 font-bold scale-105'
                  : 'text-slate-500 hover:text-emerald-800 hover:bg-slate-50'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600 stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-emerald-800' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
