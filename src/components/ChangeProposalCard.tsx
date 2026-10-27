import React, { useState } from 'react';
import { 
  FileCode2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Check, 
  Clock, 
  ShieldCheck, 
  ChevronRight,
  Terminal,
  Sparkles
} from 'lucide-react';
import { CodeChangeProposal } from '../types';

interface ChangeProposalCardProps {
  proposal: CodeChangeProposal;
  onApply: (proposalId: string) => Promise<void>;
  onReject: (proposalId: string) => void;
}

export const ChangeProposalCard: React.FC<ChangeProposalCardProps> = ({
  proposal,
  onApply,
  onReject
}) => {
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const handleApplyClick = async () => {
    setIsApplying(true);
    try {
      await onApply(proposal.proposalId);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="mt-3 p-3.5 sm:p-4 rounded-2xl bg-white border border-emerald-200/90 shadow-sm space-y-3 text-slate-800 animate-fade-in min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
            <FileCode2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {proposal.title}
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              Proposal ID: {proposal.proposalId}
            </span>
          </div>
        </div>

        <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
          proposal.status === 'applied' ? 'bg-emerald-100 text-emerald-800' :
          proposal.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
          'bg-amber-100 text-amber-900'
        }`}>
          {proposal.status === 'proposed' ? 'Action Required' : proposal.status}
        </span>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        {proposal.description}
      </p>

      {/* Affected Files List */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
          Affected Project Files ({proposal.affectedFiles.length})
        </span>
        <div className="flex flex-wrap gap-1.5">
          {proposal.affectedFiles.map((file, i) => (
            <span 
              key={i}
              className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1"
            >
              <FileCode2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
              <span className="truncate">{file}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Intended Changes Checklist */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
        <span className="font-semibold text-slate-800 block text-[11px] uppercase tracking-wider">
          Intended Modifications & Verification
        </span>
        <ul className="space-y-1 text-slate-600 text-[11px]">
          {proposal.intendedChanges.map((change, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{change}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Risk Assessment & Rollback Policy */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span>Risk Level: <strong className="text-slate-800 capitalize">{proposal.riskLevel}</strong></span>
        </div>
        <span className="text-slate-500 truncate max-w-xs">{proposal.rollbackPlan}</span>
      </div>

      {/* Applied Validation Result */}
      {proposal.status === 'applied' && proposal.validationResult && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-mono flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="truncate">{proposal.validationResult}</span>
        </div>
      )}

      {/* Actions (Only active when in 'proposed' state) */}
      {proposal.status === 'proposed' && (
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onReject(proposal.proposalId)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
          >
            Reject Proposal
          </button>
          <button
            type="button"
            onClick={handleApplyClick}
            disabled={isApplying}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isApplying ? 'Validating & Applying...' : 'Apply Change Proposal'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
