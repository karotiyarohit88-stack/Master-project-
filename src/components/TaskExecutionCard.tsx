import React from 'react';
import { 
  Play, 
  Film, 
  Compass, 
  Share2, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  ChevronRight,
  Terminal,
  ShieldCheck,
  Image as ImageIcon,
  Download,
  AlertTriangle
} from 'lucide-react';
import { TaskCardData, AppView } from '../types';

interface TaskExecutionCardProps {
  taskCard: TaskCardData;
  onNavigateToView?: (view: AppView) => void;
}

export const TaskExecutionCard: React.FC<TaskExecutionCardProps> = ({
  taskCard,
  onNavigateToView
}) => {
  const getIcon = () => {
    switch (taskCard.type) {
      case 'video': return Film;
      case 'autopilot': return Compass;
      case 'publishing': return Share2;
      case 'image': return ImageIcon;
      default: return Play;
    }
  };

  const getTargetView = (): AppView => {
    switch (taskCard.type) {
      case 'video': return 'video';
      case 'autopilot': return 'autopilot';
      case 'publishing': return 'publishing';
      default: return 'chat';
    }
  };

  const Icon = getIcon();

  const getStatusBadge = () => {
    switch (taskCard.status) {
      case 'completed_verified':
      case 'completed':
        return { label: 'Completed — Verified', style: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'running':
        return { label: 'Running', style: 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse' };
      case 'waiting_approval':
        return { label: 'Waiting for Approval', style: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'partially_completed':
        return { label: 'Partially Completed', style: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'not_connected':
        return { label: 'Not Connected', style: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'not_tested':
        return { label: 'Not Tested', style: 'bg-slate-100 text-slate-700 border-slate-300' };
      case 'failed':
        return { label: 'Failed', style: 'bg-rose-100 text-rose-800 border-rose-300' };
      default:
        return { label: taskCard.status.replace('_', ' '), style: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
  };

  const badge = getStatusBadge();
  const mediaUrl = taskCard.imageUrl || taskCard.outputUrl;

  return (
    <div className="mt-3 p-3.5 sm:p-4 rounded-2xl bg-white border border-emerald-200/90 shadow-2xs space-y-3 text-slate-800 animate-fade-in min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {taskCard.title}
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              Task ID: {taskCard.taskId} • Type: {taskCard.type.toUpperCase()}
            </span>
          </div>
        </div>

        <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold flex-shrink-0 ${badge.style}`}>
          {badge.label}
        </span>
      </div>

      {/* Progress bar if running */}
      {taskCard.progress !== undefined && taskCard.status !== 'completed' && taskCard.status !== 'completed_verified' && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Execution Progress</span>
            <span>{taskCard.progress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div 
              className="h-full bg-emerald-600 transition-all duration-500"
              style={{ width: `${taskCard.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Image / Graphic Media Preview inside chat */}
      {taskCard.type === 'image' && mediaUrl && (
        <div className="space-y-2 pt-1">
          <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-2xs">
            <img 
              src={mediaUrl} 
              alt={taskCard.title} 
              className="w-full h-auto max-h-80 object-contain mx-auto bg-slate-950" 
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs pt-1 flex-wrap">
            <span className="text-slate-500 text-[11px] font-mono">1000x1000 High-Res Design Generated</span>
            <a
              href={mediaUrl}
              download={`${taskCard.title.replace(/\s+/g, '_')}_poster.svg`}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Deliverable</span>
            </a>
          </div>
        </div>
      )}

      {/* Video Preview if video asset ready */}
      {taskCard.type === 'video' && taskCard.outputUrl && (
        <div className="space-y-2 pt-1">
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-black">
            <video controls className="w-full h-auto max-h-72">
              <source src={taskCard.outputUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px] font-mono">Rendered Video Output</span>
            <a
              href={taskCard.outputUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Video Asset</span>
            </a>
          </div>
        </div>
      )}

      {/* Output asset preview link for other types */}
      {taskCard.type !== 'image' && taskCard.type !== 'video' && taskCard.outputUrl && (
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium truncate flex-1">Output Deliverable Ready</span>
          <a
            href={taskCard.outputUrl}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 flex-shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Asset</span>
          </a>
        </div>
      )}

      {/* Logs preview */}
      {taskCard.logs && taskCard.logs.length > 0 && (
        <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[10px] space-y-0.5">
          {taskCard.logs.map((log, i) => (
            <div key={i} className="truncate">{log}</div>
          ))}
        </div>
      )}

      {/* Navigation button to jump to full Control Center tab */}
      {onNavigateToView && getTargetView() !== 'chat' && (
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={() => onNavigateToView(getTargetView())}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>View in {getTargetView().toUpperCase()} Center</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
