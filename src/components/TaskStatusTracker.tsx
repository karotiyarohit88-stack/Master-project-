import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  AlertCircle, 
  BrainCircuit, 
  FileText, 
  PlayCircle 
} from 'lucide-react';
import { TaskStatus } from '../types';

interface TaskStatusTrackerProps {
  currentStatus: TaskStatus;
  isRisky?: boolean;
}

export const TaskStatusTracker: React.FC<TaskStatusTrackerProps> = ({ currentStatus, isRisky }) => {
  if (currentStatus === 'idle') return null;

  const steps: { key: TaskStatus; label: string; icon: React.ReactNode; color: string }[] = [
    {
      key: 'Understanding',
      label: 'Understanding',
      icon: <BrainCircuit className="w-3.5 h-3.5" />,
      color: 'text-emerald-700 border-emerald-400 bg-emerald-50'
    },
    {
      key: 'Planning',
      label: 'Planning',
      icon: <FileText className="w-3.5 h-3.5" />,
      color: 'text-teal-700 border-teal-400 bg-teal-50'
    },
    ...(isRisky ? [{
      key: 'Waiting for Approval' as TaskStatus,
      label: 'Waiting for Approval',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      color: 'text-amber-800 border-amber-400 bg-amber-50'
    }] : []),
    {
      key: 'Running',
      label: 'Running',
      icon: <PlayCircle className="w-3.5 h-3.5" />,
      color: 'text-emerald-800 border-emerald-500 bg-emerald-100'
    },
    {
      key: currentStatus === 'Failed' ? 'Failed' : 'Completed',
      label: currentStatus === 'Failed' ? 'Failed' : 'Completed',
      icon: currentStatus === 'Failed' ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />,
      color: currentStatus === 'Failed' ? 'text-rose-800 border-rose-400 bg-rose-50' : 'text-emerald-900 border-emerald-600 bg-emerald-50'
    }
  ];

  const getStepState = (stepKey: TaskStatus): 'active' | 'done' | 'pending' | 'failed' => {
    if (currentStatus === 'Failed' && stepKey === 'Failed') return 'failed';
    if (currentStatus === stepKey) return 'active';

    const order: TaskStatus[] = isRisky 
      ? ['Understanding', 'Planning', 'Waiting for Approval', 'Running', 'Completed']
      : ['Understanding', 'Planning', 'Running', 'Completed'];

    const currentIndex = order.indexOf(currentStatus);
    const stepIndex = order.indexOf(stepKey);

    if (stepIndex !== -1 && currentIndex !== -1 && stepIndex < currentIndex) {
      return 'done';
    }
    return 'pending';
  };

  return (
    <div className="w-full max-w-full bg-white border border-emerald-100 rounded-2xl p-2.5 sm:p-3 shadow-xs min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5 truncate">
          <Clock className="w-3.5 h-3.5 text-emerald-600 animate-pulse flex-shrink-0" />
          <span className="truncate">Task Status</span>
        </span>
        <span className={`text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-mono font-semibold uppercase tracking-wide border flex-shrink-0 ${
          currentStatus === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
          currentStatus === 'Failed' ? 'bg-rose-50 text-rose-800 border-rose-300' :
          currentStatus === 'Waiting for Approval' ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse' :
          'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {currentStatus}
        </span>
      </div>

      {/* Progress stepper line: smooth horizontal scroll on narrow mobile, wrapping on tablet/desktop */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-emerald-200 touch-pan-x w-full min-w-0">
        {steps.map((step, idx) => {
          const state = getStepState(step.key);

          return (
            <div 
              key={idx} 
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] sm:text-xs font-mono transition-all flex-shrink-0 whitespace-nowrap ${
                state === 'active' 
                  ? `${step.color} shadow-xs ring-2 ring-emerald-500/20 font-bold scale-[1.01]` 
                  : state === 'done'
                  ? 'bg-slate-50 border-slate-200 text-slate-400 line-through opacity-75'
                  : state === 'failed'
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              <span className={`flex-shrink-0 ${state === 'active' ? 'animate-bounce text-emerald-600' : ''}`}>
                {step.icon}
              </span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
