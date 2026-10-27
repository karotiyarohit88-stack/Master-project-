import React from 'react';
import { 
  Layout, 
  Search, 
  FileCode2, 
  Bot, 
  Database, 
  ShieldCheck, 
  AlertTriangle 
} from 'lucide-react';

interface PromptBlueprintItem {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  prompt: string;
  badge?: string;
  isRisky?: boolean;
}

const PRIMARY_SUGGESTED_ACTIONS: PromptBlueprintItem[] = [
  {
    id: 'build-ui',
    title: 'Build UI',
    category: 'Frontend & Design',
    icon: <Layout className="w-4 h-4 text-emerald-600 flex-shrink-0" />,
    prompt: 'Build a clean, modern, mobile-responsive React component with Tailwind CSS for an analytics dashboard cards layout.',
    badge: 'Popular'
  },
  {
    id: 'search-info',
    title: 'Search Information',
    category: 'Architecture Research',
    icon: <Search className="w-4 h-4 text-emerald-600 flex-shrink-0" />,
    prompt: 'Search and explain architectural patterns for event-driven microservices with Redis Streams and PostgreSQL. Note: Live web search is simulated in prototype phase.',
    badge: 'Research'
  },
  {
    id: 'review-project',
    title: 'Review Project',
    category: 'Code Quality',
    icon: <FileCode2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />,
    prompt: 'Review the current Master Project AI Agent architecture, component structure, security bounds, and recommend 3 immediate improvements.',
    badge: 'Audit'
  },
  {
    id: 'create-agent',
    title: 'Create Agent',
    category: 'Worker Agent Spec',
    icon: <Bot className="w-4 h-4 text-emerald-600 flex-shrink-0" />,
    prompt: 'Design a specialized worker agent specification for an automated Database Migration Agent. Define inputs, outputs, verification steps, and safety constraints.',
    badge: 'Sub-Agent'
  },
  {
    id: 'db-planning',
    title: 'Database Schema',
    category: 'Database Planning',
    icon: <Database className="w-4 h-4 text-emerald-600 flex-shrink-0" />,
    prompt: 'Plan a PostgreSQL 16 schema with tables for users, teams, memberships, and audit logs with composite indexes and row-level security.'
  },
  {
    id: 'risk-approval',
    title: 'Safety Gate Test',
    category: 'Approval Gate',
    icon: <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />,
    prompt: 'DROP TABLE customer_records_prod CASCADE; delete from audit_trail;',
    badge: 'Safety Test',
    isRisky: true
  }
];

interface PromptBlueprintsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export const PromptBlueprints: React.FC<PromptBlueprintsProps> = ({ onSelectPrompt, disabled }) => {
  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="truncate">Suggested Actions</span>
        </span>
        <span className="text-[10px] text-slate-500 font-sans hidden sm:inline truncate">
          Tap any card to populate
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-emerald-200 touch-pan-x w-full min-w-0">
        {PRIMARY_SUGGESTED_ACTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(item.prompt)}
            className={`flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-left transition-all active:scale-[0.98] cursor-pointer shadow-2xs max-w-[190px] xs:max-w-[220px] min-w-0 ${
              item.isRisky
                ? 'bg-amber-50/80 border-amber-200/90 text-amber-900 hover:bg-amber-100 hover:border-amber-300'
                : 'bg-white border-emerald-100/90 text-slate-800 hover:bg-emerald-50/50 hover:border-emerald-300'
            }`}
          >
            <div className={`p-1.5 rounded-lg flex-shrink-0 ${
              item.isRisky ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {item.icon}
            </div>

            <div className="min-w-0 flex-1 pr-0.5">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-xs font-semibold truncate text-slate-900">{item.title}</span>
                {item.badge && (
                  <span className={`text-[8px] sm:text-[9px] font-mono px-1 py-0.2 rounded uppercase font-bold tracking-wider flex-shrink-0 ${
                    item.isRisky
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 block truncate">{item.category}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
