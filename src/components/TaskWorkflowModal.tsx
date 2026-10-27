import React, { useState } from 'react';
import { 
  X, 
  Play, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  Wrench, 
  ChevronRight,
  ListOrdered
} from 'lucide-react';

export interface WorkflowStepItem {
  id: string;
  name: string;
  description: string;
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval';
  expectedResult?: string;
  outputSummary?: string;
}

interface TaskWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  currentStepIndex: number;
  steps: WorkflowStepItem[];
  logs: string[];
  onStart: () => void;
  onApproveStep: () => void;
  onNextStep: () => void;
  onRetry: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
  requiresApproval?: boolean;
  approvalWarning?: string;
}

export const TaskWorkflowModal: React.FC<TaskWorkflowModalProps> = ({
  isOpen,
  onClose,
  taskTitle,
  currentStepIndex,
  steps,
  logs,
  onStart,
  onApproveStep,
  onNextStep,
  onRetry,
  onCancel,
  isProcessing = false,
  requiresApproval = false,
  approvalWarning = '⚠️ मानवीय अनुमति आवश्यक है। यह कार्रवाई सार्वजनिक रूप से दिखाई दे सकती है।'
}) => {
  const [showHindiGate, setShowHindiGate] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentStep = steps[currentStepIndex] || steps[0];
  const progressPercent = Math.round(((currentStepIndex + 1) / (steps.length || 1)) * 100);

  const handleApproveClick = () => {
    if (!showHindiGate) {
      setShowHindiGate(true);
    } else {
      onApproveStep();
      setShowHindiGate(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col justify-between overflow-hidden min-w-0 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">{taskTitle}</h3>
              <p className="text-[11px] text-slate-500 truncate">Master Project AI Agent Workflow Engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Workflow Body */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-w-0">
          
          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span>प्रगति (Progress): Step {currentStepIndex + 1} of {steps.length}</span>
              <span className="font-mono text-emerald-700">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div 
                className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Numbered Steps List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-emerald-600" />
              <span>Step-by-Step Execution Plan</span>
            </h4>

            <div className="space-y-2">
              {steps.map((step, idx) => {
                const isCurrent = idx === currentStepIndex;
                const isCompleted = step.status === 'completed' || idx < currentStepIndex;

                return (
                  <div 
                    key={step.id || idx}
                    className={`p-3 rounded-2xl border transition-all text-xs space-y-1 ${
                      isCurrent 
                        ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs' 
                        : isCompleted 
                        ? 'bg-slate-50 border-slate-200 opacity-80' 
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                          isCompleted ? 'bg-emerald-600 text-white' : isCurrent ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {isCompleted ? <Check className="w-3 h-3" /> : idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 truncate">{step.name}</span>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 flex-shrink-0">
                        Tool: {step.toolName}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 pl-7">{step.description}</p>
                    
                    {step.expectedResult && (
                      <p className="text-[10px] text-emerald-800 font-mono pl-7">
                        👉 Expected: {step.expectedResult}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2-Step Hindi Warning Gate if Approval Required */}
          {requiresApproval && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <h5 className="font-bold text-xs">कार्रवाई समीक्षा (Human Approval Required)</h5>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                {approvalWarning}
              </p>
              {showHindiGate && (
                <div className="p-2 rounded-xl bg-amber-100 text-amber-950 text-[11px] font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                  <span>क्या आप पुष्टि करते हैं? अनुमति देने के लिए फिर से दबाएं।</span>
                </div>
              )}
            </div>
          )}

          {/* Execution Logs Area */}
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Real-Time Execution Logs</span>
            </h4>
            <div className="bg-slate-900 text-emerald-400 p-3 rounded-2xl font-mono text-[11px] max-h-32 overflow-y-auto space-y-1 border border-slate-800">
              {logs.length > 0 ? (
                logs.map((log, lIdx) => (
                  <div key={lIdx} className="leading-snug break-words">• {log}</div>
                ))
              ) : (
                <div className="text-slate-500">Ready to execute workflow. Logs will stream here live.</div>
              )}
            </div>
          </div>

        </div>

        {/* Action Buttons Footer */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
          >
            रद्द करें (Cancel)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>पुनः प्रयास (Retry)</span>
            </button>

            {requiresApproval ? (
              <button
                type="button"
                onClick={handleApproveClick}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{showHindiGate ? 'पुष्टि करके अनुमति दें' : 'समीक्षा करें (Approve)'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onNextStep}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
                <span>अगला चरण (Next Step)</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
