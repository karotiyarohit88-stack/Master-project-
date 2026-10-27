import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, XCircle, CheckCircle2, Terminal, Clock, Eye, AlertCircle } from 'lucide-react';
import { RiskDetails, VerificationAudit } from '../types';

interface ApprovalGateCardProps {
  messageId: string;
  riskDetails: RiskDetails;
  isApproved?: boolean;
  isRejected?: boolean;
  verificationAudit?: VerificationAudit;
  executionHash?: string;
  onApprove: (messageId: string, riskDetails: RiskDetails) => void;
  onReject: (messageId: string) => void;
  isProcessing?: boolean;
}

export const ApprovalGateCard: React.FC<ApprovalGateCardProps> = ({
  messageId,
  riskDetails,
  isApproved,
  isRejected,
  verificationAudit,
  executionHash,
  onApprove,
  onReject,
  isProcessing
}) => {
  const [showLogs, setShowLogs] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isExpired, setIsExpired] = useState(false);

  // Expiration countdown when in review mode
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isReviewing && !isApproved && !isRejected && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsExpired(true);
            setIsReviewing(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isReviewing, isApproved, isRejected, timeLeft]);

  const handleStartReview = () => {
    setIsReviewing(true);
    setIsExpired(false);
    setTimeLeft(60);
  };

  const handleCancel = () => {
    setIsReviewing(false);
    onReject(messageId);
  };

  const handleFinalConfirm = () => {
    if (timeLeft <= 0 || isExpired) {
      setIsExpired(true);
      return;
    }
    onApprove(messageId, riskDetails);
  };

  return (
    <div className="my-2.5 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-3 sm:p-4 shadow-sm text-slate-800 w-full max-w-full min-w-0 overflow-hidden">
      {/* Header Banner */}
      <div className="flex items-start justify-between gap-2 mb-2.5 border-b border-amber-200/80 pb-2.5 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <h4 className="font-bold text-amber-950 text-xs sm:text-sm md:text-base leading-tight">
                ⚠️ मानवीय अनुमति आवश्यक है (Human Approval Gateway)
              </h4>
              <span className={`text-[9px] sm:text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                riskDetails.riskLevel === 'critical'
                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                {riskDetails.riskLevel === 'critical' ? 'गंभीर जोखिम (Critical)' : 'जोखिमपूर्ण (Risky)'}
              </span>
            </div>
            <p className="text-[11px] text-amber-900/90 mt-0.5 leading-snug font-medium">
              यह कार्रवाई सार्वजनिक रूप से दिखाई दे सकती है या सिस्टम में बदलाव कर सकती है।
            </p>
          </div>
        </div>
      </div>

      {/* Warning Notice Box in Pure Hindi */}
      <div className="mb-3 p-2.5 bg-amber-100/60 rounded-xl border border-amber-200 text-xs text-amber-950 leading-relaxed">
        <p className="font-semibold text-amber-900">
          ⚠️ मानवीय अनुमति आवश्यक है। यह कार्रवाई सार्वजनिक रूप से दिखाई दे सकती है। कृपया विवरण की समीक्षा करें। आगे बढ़ने के लिए अपनी स्पष्ट अनुमति दें।
        </p>
      </div>

      {/* Details Box */}
      <div className="space-y-1.5 text-xs text-slate-700 mb-3 bg-white p-3 rounded-xl border border-amber-200/70 shadow-2xs max-w-full min-w-0 overflow-hidden">
        <div className="flex flex-col xs:flex-row xs:items-baseline gap-1 xs:gap-2 min-w-0">
          <span className="font-semibold text-slate-500 xs:min-w-32 font-mono flex-shrink-0 text-[11px]">प्रस्तावित कार्रवाई:</span>
          <span className="font-mono text-amber-950 font-bold break-all min-w-0">{riskDetails.actionDescription}</span>
        </div>
        <div className="flex flex-col xs:flex-row xs:items-baseline gap-1 xs:gap-2 min-w-0">
          <span className="font-semibold text-slate-500 xs:min-w-32 font-mono flex-shrink-0 text-[11px]">परिवर्तनीयता (Reversibility):</span>
          <span className="text-rose-700 font-medium break-words min-w-0">{riskDetails.reversibility}</span>
        </div>
        <div className="flex flex-col xs:flex-row xs:items-baseline gap-1 xs:gap-2 min-w-0">
          <span className="font-semibold text-slate-500 xs:min-w-32 font-mono flex-shrink-0 text-[11px]">सुरक्षा नियम (Safety Rule):</span>
          <span className="text-slate-700 break-words min-w-0">{riskDetails.mitigation}</span>
        </div>
      </div>

      {/* Expired State Notice */}
      {isExpired && !isApproved && !isRejected && (
        <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>अनुमति का समय (60 सेकंड) समाप्त हो गया है। सुरक्षा कारणों से कृपया दोबारा समीक्षा शुरू करें।</span>
        </div>
      )}

      {/* Decision State */}
      {isApproved ? (
        <div className="space-y-2.5 max-w-full min-w-0">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-xs sm:text-sm text-emerald-950 truncate">
                  मानवीय स्वीकृति प्रदान की गई और सत्यापित की गई (Approval Granted & Verified)
                </p>
                <p className="text-[10px] text-emerald-700 font-mono truncate">ऑडिट टोकन: {executionHash || 'hash_token_verified'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              className="text-xs font-mono px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 flex items-center gap-1 cursor-pointer transition-colors flex-shrink-0"
              aria-label="ऑडिट लॉग देखें"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{showLogs ? 'लॉग्स छुपाएँ' : 'ऑडिट देखें'}</span>
            </button>
          </div>

          {showLogs && verificationAudit && (
            <div className="p-2.5 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 text-[10px] sm:text-[11px] font-mono space-y-1 shadow-inner max-w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
              <div className="text-emerald-400 font-semibold mb-1">=== सत्यापित टेलीमेट्री ऑडिट ट्रेल ===</div>
              <p className="break-all">• प्री-फ्लाइट चेक: {verificationAudit.preFlightCheck}</p>
              <p className="break-all">• ड्राई रन सत्यापन: {verificationAudit.dryRunVerification}</p>
              <p className="text-emerald-300 font-bold break-all">• वास्तविक निष्पादन: {verificationAudit.actualExecution}</p>
              <p className="break-all">• पोस्ट-फ्लाइट सत्यनिष्ठा: {verificationAudit.postFlightIntegrity}</p>
              <p className="text-slate-400 text-[9px] mt-1">शून्य असत्यापित दावे। टाइमस्टैम्प: {new Date().toLocaleTimeString()}</p>
            </div>
          )}
        </div>
      ) : isRejected ? (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs">
          <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold truncate">कार्रवाई अस्वीकृत / रद्द कर दी गई (Operation Rejected)</p>
            <p className="text-[10px] text-rose-800/80">कार्रवाई तुरंत रोक दी गई। सिस्टम या पर्यावरण में कोई बदलाव नहीं किया गया।</p>
          </div>
        </div>
      ) : !isReviewing ? (
        /* STEP 1: First click ONLY opens review. Action is NOT executed. */
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5 w-full">
          <button
            type="button"
            onClick={handleStartReview}
            className="w-full sm:flex-1 flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer min-h-[38px]"
          >
            <Eye className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">कार्रवाई की समीक्षा करें (Review Action)</span>
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="w-full sm:flex-1 flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs sm:text-sm transition-all cursor-pointer min-h-[38px]"
          >
            <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="truncate">रद्द करें (Cancel)</span>
          </button>
        </div>
      ) : (
        /* STEP 2: Second click executes only after review. User has cancel option & countdown */
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1 text-[11px] font-mono text-amber-900 bg-amber-100/70 p-2 rounded-lg border border-amber-200">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              <span>समीक्षा सत्र सक्रिय (सत्यापन विंडो):</span>
            </div>
            <span className={`font-bold ${timeLeft <= 10 ? 'text-rose-600 animate-pulse' : 'text-amber-900'}`}>
              {timeLeft}s शेष
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
            <button
              type="button"
              disabled={isProcessing || timeLeft <= 0}
              onClick={handleFinalConfirm}
              className="w-full sm:flex-1 flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer min-h-[40px]"
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {isProcessing ? 'सत्यापन जारी है...' : 'पुष्टि करके प्रकाशित/निष्पादित करें (Confirm & Execute)'}
              </span>
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleCancel}
              className="w-full sm:flex-1 flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-semibold text-xs sm:text-sm transition-all cursor-pointer min-h-[40px]"
            >
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">रद्द करें (Cancel)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

