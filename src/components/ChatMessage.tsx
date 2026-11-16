import React, { useState } from 'react';
import { 
  Bot, 
  User, 
  Copy, 
  Check, 
  Volume2,
  VolumeX, 
  AlertCircle, 
  RefreshCw, 
  Info,
  FileCode2,
  Play,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import { ChatMessageItem, RiskDetails, AppSettings, AppView } from '../types';
import { MarkdownRenderer } from '../utils/markdownRenderer';
import { ApprovalGateCard } from './ApprovalGateCard';
import { ChangeProposalCard } from './ChangeProposalCard';
import { TaskExecutionCard } from './TaskExecutionCard';
import { copyToClipboard } from '../utils/clipboard';

interface ChatMessageProps {
  message: ChatMessageItem;
  onApproveAction: (messageId: string, riskDetails: RiskDetails) => void;
  onRejectAction: (messageId: string) => void;
  onRetry?: (content: string) => void;
  isApproving?: boolean;
  settings?: AppSettings;
  onApplyProposal?: (proposalId: string) => Promise<void>;
  onRejectProposal?: (proposalId: string) => void;
  onNavigateToView?: (view: AppView) => void;
}

const extractInlineImages = (content: string): { text: string; images: string[] } => {
  const images: string[] = [];
  const imageDataUrl = /data:image\/(?:png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=\r\n]+/gi;
  const text = content.replace(imageDataUrl, (value) => {
    const compact = value.replace(/\s/g, '');
    const payload = compact.slice(compact.indexOf(',') + 1);
    if (payload.length > 12 * 1024 * 1024 || payload.length < 16 || payload.length % 4 !== 0) return '[Image omitted: invalid or oversized image data]';
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return '[Image omitted: invalid image data]';
    images.push(compact);
    return '';
  });
  let safeText = text.replace(/\n{3,}/g, '\n\n').trim();
  if (images.length === 0) {
    const candidate = safeText.trim();
    const detectedMime = candidate.startsWith('iVBORw0KGgo') ? 'image/png'
      : candidate.startsWith('/9j/') ? 'image/jpeg'
      : candidate.startsWith('R0lGOD') ? 'image/gif'
      : candidate.startsWith('UklGR') ? 'image/webp'
      : null;
    if (detectedMime && candidate.length >= 256 && candidate.length <= 12 * 1024 * 1024 && candidate.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(candidate)) {
      images.push(`data:${detectedMime};base64,${candidate}`);
      safeText = '';
    }
  }
  return { text: safeText, images };
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onApproveAction,
  onRejectAction,
  onRetry,
  isApproving,
  settings,
  onApplyProposal,
  onRejectProposal,
  onNavigateToView
}) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isUser = message.role === 'user';
  const renderedContent = extractInlineImages(message.content);

  const copyContent = async () => {
    const success = await copyToClipboard(renderedContent.text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleReadAloud = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(renderedContent.text);
    const language = settings?.selectedLanguage;
    if (language && language !== 'auto') {
      const languageMap: Record<string, string> = { hi: 'hi-IN', hinglish: 'hi-IN', en: 'en-IN', pa: 'pa-IN', ur: 'ur-PK', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN', gu: 'gu-IN' };
      utterance.lang = languageMap[language] || language;
    }
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'software_design':
        return { label: 'Software Design', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'programming':
        return { label: 'Programming', color: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'database':
        return { label: 'Database Planning', color: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
      case 'testing':
        return { label: 'Automated Testing', color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'security':
        return { label: 'Security Review', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      case 'deployment':
        return { label: 'Deployment CI/CD', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'maintenance':
        return { label: 'Maintenance Ops', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'worker_agent':
        return { label: 'Worker Agent Brief', color: 'bg-purple-50 text-purple-800 border-purple-200' };
      default:
        return { label: 'General', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const getClassificationBadge = (cls?: string) => {
    switch (cls) {
      case 'code_change':
        return { label: 'Code Change Proposal', icon: FileCode2, color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      case 'task_execution':
        return { label: 'Task Execution', icon: Play, color: 'bg-cyan-100 text-cyan-900 border-cyan-300' };
      case 'risky_action':
        return { label: 'Security Gate', icon: ShieldAlert, color: 'bg-amber-100 text-amber-900 border-amber-300' };
      default:
        return { label: 'Question', icon: HelpCircle, color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const badge = getCategoryBadge(message.category);
  const classBadge = message.classification ? getClassificationBadge(message.classification) : null;
  const isCompact = settings?.bubbleDensity === 'compact';
  const fontSizeClass = settings?.fontSize === 'small' ? 'text-xs' : settings?.fontSize === 'large' ? 'text-base' : 'text-sm';

  // Check if content contains Arabic / Urdu RTL script
  const isRtl = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(message.content);

  return (
    <div className={`flex gap-2 sm:gap-3 w-full max-w-full min-w-0 ${isUser ? 'flex-row-reverse' : 'flex-row'} ${isCompact ? 'py-1' : 'py-2'}`}>
      {/* Avatar Icon */}
      <div 
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5 overflow-hidden ${
          isUser 
            ? 'bg-slate-800 text-white' 
            : 'bg-white border border-emerald-200 p-0.5'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <img src="/assets/aistudio/1791973196299_d0ac9fe0.png" alt="Master AI Agent Avatar" className="w-full h-full object-contain rounded-lg" />}
      </div>

      {/* Message Bubble Container */}
      <div 
        className={`flex flex-col min-w-0 max-w-[88%] sm:max-w-[85%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Header tags row */}
        <div className="flex items-center gap-1.5 mb-1 px-1 flex-wrap min-w-0">
          <span className="text-[11px] font-bold text-slate-700 truncate">
            {isUser ? 'You' : 'Master Project AI Agent'}
          </span>

          {!isUser && classBadge && (
            <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold flex-shrink-0 ${classBadge.color}`}>
              <classBadge.icon className="w-3 h-3 flex-shrink-0" />
              <span>{classBadge.label}</span>
            </span>
          )}

          {!isUser && message.category && (
            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-md border font-semibold flex-shrink-0 ${badge.color}`}>
              {badge.label}
            </span>
          )}

          <span className="text-[10px] text-slate-400 font-mono">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Message Content Bubble */}
        <div 
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`relative rounded-2xl w-full min-w-0 break-words shadow-2xs ${
            isRtl ? 'text-right font-sans' : 'text-left'
          } ${
            isCompact ? 'p-2.5 sm:p-3' : 'p-3.5 sm:p-4'
          } ${
            isUser 
              ? 'bg-emerald-600 text-white rounded-tr-xs' 
              : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'
          }`}
        >
          {isUser ? (
            <>
              <p className={`whitespace-pre-wrap ${fontSizeClass} leading-relaxed break-words max-w-full overflow-hidden`}>
                {renderedContent.text}
              </p>
              {renderedContent.images.map((src, index) => <img key={index} src={src} alt={`Attached image ${index + 1}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="mt-2 block max-w-full w-auto max-h-72 rounded-xl border border-white/30 object-contain" />)}
            </>
          ) : (
            <div className={`overflow-hidden max-w-full min-w-0 ${fontSizeClass}`}>
              <MarkdownRenderer content={renderedContent.text} />
              {renderedContent.images.map((src, index) => <figure key={index} className="mt-2 max-w-full"><img src={src} alt={`Generated image ${index + 1}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="block max-w-full max-h-80 rounded-xl border border-slate-200 object-contain" /><figcaption className="mt-1 text-[10px] text-slate-400">Image attachment</figcaption></figure>)}
            </div>
          )}

          {/* Assistant Action Bar (Copy Button) */}
          {!isUser && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono text-[10px]">Master Project AI</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleReadAloud}
                  className="flex items-center gap-1 hover:text-emerald-700 transition-colors cursor-pointer p-1 -m-1 rounded"
                  title={isSpeaking ? 'Stop reading reply' : 'Listen to reply'}
                  aria-label={isSpeaking ? 'Stop reading reply' : 'Listen to reply'}
                >
                  {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-emerald-600" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{isSpeaking ? 'Stop' : 'Listen'}</span>
                </button>
                <button
                  type="button"
                  onClick={copyContent}
                  className="flex items-center gap-1 hover:text-emerald-700 transition-colors cursor-pointer p-1 -m-1 rounded"
                  title="Copy message text"
                  aria-label="Copy message text"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Integration Note if simulated/mocked */}
        {message.integrationNote && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 max-w-full min-w-0">
            <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span className="min-w-0 break-words">{message.integrationNote}</span>
          </div>
        )}

        {/* Code Change Proposal Card if present */}
        {message.codeProposal && onApplyProposal && onRejectProposal && (
          <div className="w-full max-w-full min-w-0 overflow-hidden">
            <ChangeProposalCard
              proposal={message.codeProposal}
              onApply={onApplyProposal}
              onReject={onRejectProposal}
            />
          </div>
        )}

        {/* Task Execution Card if present */}
        {message.taskCard && (
          <div className="w-full max-w-full min-w-0 overflow-hidden">
            <TaskExecutionCard
              taskCard={message.taskCard}
              onNavigateToView={onNavigateToView}
            />
          </div>
        )}

        {/* Approval Gate card if risky action */}
        {message.isRiskyAction && message.riskDetails && (
          <div className="w-full max-w-full min-w-0 overflow-hidden">
            <ApprovalGateCard
              messageId={message.id}
              riskDetails={message.riskDetails}
              isApproved={message.isApproved}
              isRejected={message.isRejected}
              verificationAudit={message.verificationAudit}
              executionHash={message.executionHash}
              onApprove={onApproveAction}
              onReject={onRejectAction}
              isProcessing={isApproving}
            />
          </div>
        )}

        {/* Error state with clear troubleshooting instructions */}
        {message.error && (
          <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2 max-w-full min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <h5 className="font-bold text-xs sm:text-sm text-amber-950 truncate">Execution Notice</h5>
            </div>
            <p className="text-xs text-amber-900 bg-white/80 p-2 rounded-lg font-mono border border-amber-200 break-all max-w-full overflow-hidden">
              {message.error}
            </p>

            {message.troubleshooting && message.troubleshooting.length > 0 && (
              <div className="text-xs pt-1">
                <span className="font-semibold text-amber-950 block mb-1">Troubleshooting Checklist:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-amber-900 text-[11px]">
                  {message.troubleshooting.map((step: string, sIdx: number) => (
                    <li key={sIdx} className="leading-snug">{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {onRetry && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onRetry(message.content)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Command
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
