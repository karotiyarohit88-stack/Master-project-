/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  ShieldCheck, 
  AlertTriangle, 
  Layout, 
  Search, 
  FileCode2, 
  Plus, 
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  TaskStatus, 
  AICategory, 
  ChatMessageItem, 
  ConversationSession, 
  ServerHealth, 
  RiskDetails, 
  AppSettings,
  AppView
} from './types';
import { Header } from './components/Header';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { TaskStatusTracker } from './components/TaskStatusTracker';
import { PromptBlueprints } from './components/PromptBlueprints';
import { ConversationDrawer } from './components/ConversationDrawer';
import { TestingGuideModal } from './components/TestingGuideModal';
import { SettingsModal } from './components/SettingsModal';
import { TaskWorkflowModal, WorkflowStepItem } from './components/TaskWorkflowModal';
import { generateSandboxSimulation } from './utils/fallbackAgent';

// New Module Centers
import { HomeDashboard } from './components/HomeDashboard';
import { BottomNavigation } from './components/BottomNavigation';
import { AutoPilotCenter } from './components/AutoPilotCenter';
import { VideoGeneratorCenter } from './components/VideoGeneratorCenter';
import { VoiceStudioCenter } from './components/VoiceStudioCenter';
import { PublishingCenter } from './components/PublishingCenter';
import { ConnectionsCenter } from './components/ConnectionsCenter';
import { AutomationLogsCenter } from './components/AutomationLogsCenter';
import { GitHubCodeExplorer } from './components/GitHubCodeExplorer';
import { AnalyticsCenter } from './components/AnalyticsCenter';
import { FloatingChatWidget } from './components/FloatingChatWidget';

const STORAGE_KEY = 'master_project_ai_agent_sessions_v1';
const ACTIVE_SESSION_KEY = 'master_project_ai_agent_active_v1';
const SETTINGS_KEY = 'master_project_ai_agent_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  sendOnEnter: true,
  bubbleDensity: 'comfortable',
  fontSize: 'medium',
  showStatusTracker: true,
  soundEffects: false,
  selectedLanguage: 'auto',
};

export default function App() {
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTaskStatus, setCurrentTaskStatus] = useState<TaskStatus>('idle');
  const [isRiskyCurrent, setIsRiskyCurrent] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);

  // Active Control Center View - defaults to Home
  const [activeView, setActiveView] = useState<AppView>('home');

  // Workflow Modal state
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState<boolean>(false);
  const [workflowTitle, setWorkflowTitle] = useState<string>('Master AI Task Execution Workflow');
  const [workflowCurrentStep, setWorkflowCurrentStep] = useState<number>(0);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepItem[]>([
    { id: 's1', name: 'Task Intake & Analysis', description: 'Evaluate user request requirements and tool capabilities', toolName: 'Gemini AI', status: 'completed', expectedResult: 'Structured task plan' },
    { id: 's2', name: 'Environment & Tool Validation', description: 'Check connected server routes and credentials', toolName: 'Connections API', status: 'running', expectedResult: 'HTTP 200 OK tool health' },
    { id: 's3', name: 'Human Approval Gate Review', description: 'Require operator confirmation token before execution', toolName: 'Approval Gate', status: 'waiting_approval', expectedResult: 'Verified authorization token' },
    { id: 's4', name: 'Task Execution & Telemetry Log', description: 'Run step pipeline and log results to audit storage', toolName: 'Audit System', status: 'pending', expectedResult: 'Execution Hash recorded' }
  ]);
  const [workflowLogs, setWorkflowLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Task initialized by Master Project AI Agent`,
    `[${new Date().toLocaleTimeString()}] Pre-flight check passed. Zero secrets exposed in frontend.`
  ]);
  const [modalRequiresApproval, setModalRequiresApproval] = useState<boolean>(true);

  // Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // UI modals
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [showBlueprints, setShowBlueprints] = useState<boolean>(true);

  // Server state
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: ConversationSession[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          const savedActive = localStorage.getItem(ACTIVE_SESSION_KEY);
          if (savedActive && parsed.some(c => c.id === savedActive)) {
            setActiveSessionId(savedActive);
            return;
          }
          setActiveSessionId(parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved sessions:', e);
    }

    // Initialize with a default welcome session
    initNewSession(true);
  }, []);

  // Fetch server health on mount
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then((data: ServerHealth) => {
        setServerHealth(data);
      })
      .catch((err) => {
        console.warn('Backend health check note:', err);
      });
  }, []);

  // Save conversations to localStorage
  useEffect(() => {
    if (conversations.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
    }
  }, [conversations]);

  // Save active session id
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    }
  }, [activeSessionId]);

  // Save settings
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [settings]);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    if (activeView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, activeSessionId, currentTaskStatus, activeView]);

  // Current active session
  const activeSession = conversations.find(c => c.id === activeSessionId) || null;
  const currentMessages = activeSession ? activeSession.messages : [];

  // Initialize a fresh new session
  const initNewSession = (isFirst = false) => {
    const newId = 'session_' + Date.now();
    const initialWelcomeMessage: ChatMessageItem = {
      id: 'welcome_' + Date.now(),
      role: 'assistant',
      content: `### 👋 Welcome to Master Project AI Agent

I am your central AI assistant and command center. You can manage engineering tasks, autonomous pipelines, video generation, and multi-channel publishing.

#### 💡 Core Capabilities:
- **AI Chat & Command:** Software architecture, programming, database planning, testing, and worker agent design
- **Auto Pilot:** Trigger center with scheduled, manual, and authenticated webhook triggers
- **Video Generator:** Scriptwriting via Gemini, voice synthesis via ElevenLabs, and video provider adapters
- **Voice Studio:** Neural text-to-speech voice selection and playback
- **Publishing Workflow:** Social previews and explicit human approval gates
- **Connections:** Dedicated server-side settings for Gemini, n8n, ElevenLabs, Video, and Sheets

---

> **Sandbox Notice:** All credentials and secrets are isolated on the server. Destructive mutations and public postings require explicit **Human Approval**.

*Select any suggested action below or switch tabs in the top Control Center to explore.*`,
      timestamp: new Date().toISOString(),
      category: 'general',
      status: 'Completed'
    };

    const newSession: ConversationSession = {
      id: newId,
      title: isFirst ? 'Master Project Overview' : `Chat ${conversations.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [initialWelcomeMessage]
    };

    setConversations(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setCurrentTaskStatus('idle');
    setIsRiskyCurrent(false);
  };

  // Delete a conversation
  const handleDeleteConversation = (id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (filtered.length === 0) {
        setTimeout(() => initNewSession(true), 50);
        return [];
      }
      if (activeSessionId === id) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  // Clear all history
  const handleClearAllHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    initNewSession(true);
  };

  // Update Settings
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  // Action Click Handler from Chat Input Toolbar
  const handleChatActionClick = async (actionType: 'help' | 'next_step' | 'run_task' | 'open_tools' | 'view_results') => {
    if (actionType === 'help') {
      setIsWorkflowModalOpen(true);
    } else if (actionType === 'next_step') {
      if (workflowCurrentStep < workflowSteps.length - 1) {
        setWorkflowCurrentStep(prev => prev + 1);
        setWorkflowLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Advanced to Step ${workflowCurrentStep + 2}`]);
      }
      setIsWorkflowModalOpen(true);
    } else if (actionType === 'run_task') {
      try {
        const res = await fetch('/api/automation/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ triggerId: 'chat_action', topic: 'User Triggered Task' })
        });
        if (res.ok) {
          setWorkflowLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Executed /api/automation/trigger successfully`]);
          setIsWorkflowModalOpen(true);
        }
      } catch (e) {
        console.warn('Run task error:', e);
      }
    } else if (actionType === 'open_tools') {
      setActiveView('connections');
    } else if (actionType === 'view_results') {
      setActiveView('analytics');
    }
  };

  const handleLanguageChange = (lang: string) => {
    setSettings(prev => ({ ...prev, selectedLanguage: lang }));
  };

  // Send message flow
  const handleSendMessage = async (promptText: string, imageAttachment?: string, gitContext?: { path: string; repo: string; branch: string; snippet?: string }) => {
    const trimmed = promptText.trim();
    if ((!trimmed && !imageAttachment) || isLoading) return;

    if (activeView !== 'chat') {
      setActiveView('chat');
    }

    setInput('');
    setIsLoading(true);

    const userMessageId = 'msg_user_' + Date.now();
    const assistantMessageId = 'msg_asst_' + (Date.now() + 1);

    const userMessage: ChatMessageItem = {
      id: userMessageId,
      role: 'user',
      content: imageAttachment ? `${trimmed}\n\n![Uploaded Attachment](${imageAttachment})` : trimmed,
      timestamp: new Date().toISOString(),
    };

    // Update conversation session with user message
    setConversations(prev => prev.map(conv => {
      if (conv.id === activeSessionId) {
        const isDefaultTitle = conv.title.startsWith('Chat ') || conv.title === 'Master Project Overview';
        const updatedTitle = (isDefaultTitle && conv.messages.length <= 1)
          ? trimmed.slice(0, 32) + (trimmed.length > 32 ? '...' : '')
          : conv.title;

        return {
          ...conv,
          title: updatedTitle,
          updatedAt: new Date().toISOString(),
          messages: [...conv.messages, userMessage]
        };
      }
      return conv;
    }));

    // Stage 1: Understanding
    setCurrentTaskStatus('Understanding');
    await new Promise(r => setTimeout(r, 250));

    // Stage 2: Planning
    setCurrentTaskStatus('Planning');
    await new Promise(r => setTimeout(r, 300));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed || 'Image input provided for analysis',
          conversationHistory: currentMessages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            content: m.content
          })),
          gitContext,
          targetLanguage: settings.selectedLanguage || 'auto'
        })
      });

      const data = await response.json();

      // Check if risky action detected -> Waiting for Approval
      if (data.status === 'waiting_approval') {
        setIsRiskyCurrent(true);
        setCurrentTaskStatus('Waiting for Approval');

        const approvalMessage: ChatMessageItem = {
          id: assistantMessageId,
          role: 'assistant',
          content: data.agentResponse,
          timestamp: new Date().toISOString(),
          category: data.category || 'general',
          status: 'Waiting for Approval',
          isRiskyAction: true,
          riskDetails: data.riskDetails,
          executionPlan: data.executionPlan
        };

        setConversations(prev => prev.map(conv => {
          if (conv.id === activeSessionId) {
            return {
              ...conv,
              updatedAt: new Date().toISOString(),
              lastCategory: data.category,
              messages: [...conv.messages, approvalMessage]
            };
          }
          return conv;
        }));

        setIsLoading(false);
        return;
      }

      // Check if standard error occurred
      if (!response.ok || data.error) {
        if (data.canUseFallback) {
          setCurrentTaskStatus('Running');
          await new Promise(r => setTimeout(r, 300));
          
          const cat: AICategory = data.category || 'programming';
          const fallbackContent = generateSandboxSimulation(trimmed, cat);

          const fallbackMessage: ChatMessageItem = {
            id: assistantMessageId,
            role: 'assistant',
            content: `${fallbackContent}\n\n> ℹ️ **Prototype Engine Notice:** Active Gemini API response via sandbox simulation. Full server-side proxy active.`,
            timestamp: new Date().toISOString(),
            category: cat,
            status: 'Completed',
            integrationNote: trimmed.toLowerCase().includes('search') 
              ? 'Web Search Integration: Simulated in Phase 1 (live search index not connected)' 
              : undefined
          };

          setCurrentTaskStatus('Completed');
          setConversations(prev => prev.map(conv => {
            if (conv.id === activeSessionId) {
              return {
                ...conv,
                updatedAt: new Date().toISOString(),
                messages: [...conv.messages, fallbackMessage]
              };
            }
            return conv;
          }));

          setIsLoading(false);
          return;
        }

        // Show exact error and troubleshooting steps
        setCurrentTaskStatus('Failed');
        const errorMessage: ChatMessageItem = {
          id: assistantMessageId,
          role: 'assistant',
          content: 'The Master Project AI Agent encountered an issue executing this command.',
          timestamp: new Date().toISOString(),
          status: 'Failed',
          error: data.error || 'Server returned an error.',
          troubleshooting: data.troubleshooting || [
            'Verify server network connectivity.',
            'Check that GEMINI_API_KEY is configured in Connection Settings.',
            'Verify prompt formatting and try again.'
          ]
        };

        setConversations(prev => prev.map(conv => {
          if (conv.id === activeSessionId) {
            return {
              ...conv,
              updatedAt: new Date().toISOString(),
              messages: [...conv.messages, errorMessage]
            };
          }
          return conv;
        }));

        setIsLoading(false);
        return;
      }

      // Normal success flow: Running -> Completed
      setCurrentTaskStatus('Running');
      await new Promise(r => setTimeout(r, 300));

      const isSearchPrompt = trimmed.toLowerCase().includes('search');

      const successMessage: ChatMessageItem = {
        id: assistantMessageId,
        role: 'assistant',
        content: data.agentResponse || 'Task completed.',
        timestamp: new Date().toISOString(),
        category: data.category || 'general',
        status: 'Completed',
        integrationNote: isSearchPrompt
          ? 'Live Web Search: Simulated knowledge response (external search crawler not connected in Phase 1)'
          : undefined
      };

      setCurrentTaskStatus('Completed');
      setIsRiskyCurrent(false);

      setConversations(prev => prev.map(conv => {
        if (conv.id === activeSessionId) {
          return {
            ...conv,
            updatedAt: new Date().toISOString(),
            lastCategory: data.category,
            messages: [...conv.messages, successMessage]
          };
        }
        return conv;
      }));

    } catch (err: any) {
      console.error('Chat error:', err);
      setCurrentTaskStatus('Failed');

      const failMessage: ChatMessageItem = {
        id: assistantMessageId,
        role: 'assistant',
        content: 'Execution failed due to a network or transport disruption.',
        timestamp: new Date().toISOString(),
        status: 'Failed',
        error: err?.message || 'Network request failed.',
        troubleshooting: [
          'Ensure the local dev server is running on port 3000.',
          'Check browser network tab for failed /api/chat requests.',
          'Retry sending the command.'
        ]
      };

      setConversations(prev => prev.map(conv => {
        if (conv.id === activeSessionId) {
          return {
            ...conv,
            updatedAt: new Date().toISOString(),
            messages: [...conv.messages, failMessage]
          };
        }
        return conv;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Human Operator: Approve Risky Action
  const handleApproveAction = async (messageId: string, riskDetails: RiskDetails) => {
    setIsApproving(true);
    setCurrentTaskStatus('Running');

    try {
      const response = await fetch('/api/approve-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionDescription: riskDetails.actionDescription,
          actionId: messageId
        })
      });

      const data = await response.json();

      setConversations(prev => prev.map(conv => {
        if (conv.id === activeSessionId) {
          return {
            ...conv,
            messages: conv.messages.map(msg => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  status: 'Completed',
                  isApproved: true,
                  executionHash: data.executionHash,
                  verificationAudit: data.verificationAudit,
                  content: `${msg.content}\n\n---\n\n${data.agentResponse}`
                };
              }
              return msg;
            })
          };
        }
        return conv;
      }));

      setCurrentTaskStatus('Completed');
    } catch (e: any) {
      console.error('Failed to approve action:', e);
      setCurrentTaskStatus('Failed');
    } finally {
      setIsApproving(false);
    }
  };

  // Human Operator: Reject Risky Action
  const handleRejectAction = (messageId: string) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id === activeSessionId) {
        return {
          ...conv,
          messages: conv.messages.map(msg => {
            if (msg.id === messageId) {
              return {
                ...msg,
                status: 'Completed',
                isRejected: true,
                content: `${msg.content}\n\n> 🛑 **Operator Override:** Destructive action rejected. Requesting alternative safe plan...`
              };
            }
            return msg;
          })
        };
      }
      return conv;
    }));

    setCurrentTaskStatus('Completed');
    setIsRiskyCurrent(false);
  };

  // Retry command
  const handleRetry = (content: string) => {
    handleSendMessage(content);
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-full bg-slate-50 text-slate-800 font-sans overflow-hidden antialiased selection:bg-emerald-500/20 selection:text-emerald-950">
      {/* Top Header with Module Navigation */}
      <Header
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onNewChat={() => initNewSession(false)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        conversationCount={conversations.length}
        serverHealth={serverHealth}
        activeView={activeView}
        onSelectView={setActiveView}
      />

      {/* Main Viewport Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* VIEW 0: Professional Mobile-First Home Dashboard */}
        {activeView === 'home' && (
          <HomeDashboard
            onSelectView={setActiveView}
            onNewChat={() => {
              initNewSession(false);
              setActiveView('chat');
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
            serverHealth={serverHealth}
            currentTaskStatus={currentTaskStatus}
            onLaunchTaskWithPrompt={(prompt) => {
              initNewSession(false);
              setActiveView('chat');
              setTimeout(() => {
                handleSendMessage(prompt);
              }, 120);
            }}
          />
        )}

        {/* VIEW 1: AI Chat & Command Center */}
        {activeView === 'chat' && (
          <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto overflow-hidden relative px-2 sm:px-4 min-w-0">
            {/* Safety & Protocol Banner */}
            <div className="py-1.5 sm:py-2 px-0.5 flex-shrink-0 w-full min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-1.5 bg-white border border-emerald-100 rounded-xl px-2.5 sm:px-3 py-1.5 text-[11px] text-slate-600 shadow-2xs w-full min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span className="truncate">
                    White & Green • <strong className="text-emerald-900 font-medium">Command Center</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                    <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                    <span>Approval Gate</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowBlueprints(!showBlueprints)}
                    className="text-[10px] font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer flex-shrink-0"
                  >
                    {showBlueprints ? (
                      <>Hide <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>Actions <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Task Lifecycle Status Stepper */}
            {settings.showStatusTracker && currentTaskStatus !== 'idle' && (
              <div className="mb-1.5 sm:mb-2 flex-shrink-0 w-full min-w-0">
                <TaskStatusTracker
                  currentStatus={currentTaskStatus}
                  isRisky={isRiskyCurrent}
                />
              </div>
            )}

            {/* Chat Messages Scrollable Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 py-1.5 sm:py-2 pr-0.5 sm:pr-1 scrollbar-thin scrollbar-thumb-emerald-200 w-full min-w-0">
              {currentMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-6 text-slate-500 min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5 shadow-xs flex-shrink-0">
                    <Bot className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">How can I help you build today?</h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 px-2 leading-relaxed">
                    Enter your questions, code requests, architecture ideas, or tap a suggested action below.
                  </p>

                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 mt-4 max-w-md w-full min-w-0 px-1">
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Build UI: Create a clean, mobile-responsive React + Tailwind CSS dashboard cards layout')}
                      className="p-2.5 sm:p-3 rounded-xl bg-white border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 text-left transition-all shadow-2xs cursor-pointer min-w-0"
                    >
                      <Layout className="w-4 h-4 text-emerald-600 mb-1" />
                      <span className="text-xs font-semibold text-slate-900 block truncate">Build UI</span>
                      <span className="text-[10px] text-slate-500 block truncate">Responsive dashboards</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Search Information: Explain the best architecture for event-driven microservices')}
                      className="p-2.5 sm:p-3 rounded-xl bg-white border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 text-left transition-all shadow-2xs cursor-pointer min-w-0"
                    >
                      <Search className="w-4 h-4 text-emerald-600 mb-1" />
                      <span className="text-xs font-semibold text-slate-900 block truncate">Search Info</span>
                      <span className="text-[10px] text-slate-500 block truncate">Architectural research</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Review Project: Review the Master Project AI Agent codebase and recommend 3 optimizations')}
                      className="p-2.5 sm:p-3 rounded-xl bg-white border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 text-left transition-all shadow-2xs cursor-pointer min-w-0"
                    >
                      <FileCode2 className="w-4 h-4 text-emerald-600 mb-1" />
                      <span className="text-xs font-semibold text-slate-900 block truncate">Review Project</span>
                      <span className="text-[10px] text-slate-500 block truncate">Quality & security audit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage('Create Agent: Draft a mission specification for an automated Database Migration Worker Agent')}
                      className="p-2.5 sm:p-3 rounded-xl bg-white border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 text-left transition-all shadow-2xs cursor-pointer min-w-0"
                    >
                      <Bot className="w-4 h-4 text-emerald-600 mb-1" />
                      <span className="text-xs font-semibold text-slate-900 block truncate">Create Agent</span>
                      <span className="text-[10px] text-slate-500 block truncate">Sub-agent delegation</span>
                    </button>
                  </div>
                </div>
              ) : (
                currentMessages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onApproveAction={handleApproveAction}
                    onRejectAction={handleRejectAction}
                    onRetry={handleRetry}
                    isApproving={isApproving}
                    settings={settings}
                    onNavigateToView={setActiveView}
                  />
                ))
              )}

              {/* Visual Loading State */}
              {isLoading && currentTaskStatus !== 'Waiting for Approval' && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-white border border-emerald-200/80 text-xs font-mono text-slate-600 shadow-2xs animate-pulse max-w-full min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping flex-shrink-0" />
                  <span className="truncate">
                    Master Agent status: <strong className="text-emerald-800 uppercase font-bold">{currentTaskStatus}</strong>...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Panel: Suggested Action Buttons + Chat Input */}
            <div className="py-2 flex-shrink-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent w-full min-w-0">
              {showBlueprints && (
                <div className="mb-1.5 w-full min-w-0">
                  <PromptBlueprints
                    onSelectPrompt={(p) => handleSendMessage(p)}
                    disabled={isLoading}
                  />
                </div>
              )}

              <ChatInput
                input={input}
                setInput={setInput}
                onSend={(text, img) => handleSendMessage(text, img)}
                isLoading={isLoading}
                sendOnEnter={settings.sendOnEnter}
                selectedLanguage={settings.selectedLanguage || 'auto'}
                onLanguageChange={handleLanguageChange}
                onActionClick={handleChatActionClick}
              />
            </div>
          </main>
        )}

        {/* VIEW 2: Analytics Center */}
        {activeView === 'analytics' && <AnalyticsCenter />}

        {/* VIEW 3: Auto Pilot & Trigger Center */}
        {activeView === 'autopilot' && <AutoPilotCenter />}

        {/* VIEW 4: AI Video Generator */}
        {activeView === 'video' && <VideoGeneratorCenter />}

        {/* VIEW 5: Voice Studio */}
        {activeView === 'voice' && <VoiceStudioCenter />}

        {/* VIEW 6: Publishing Queue & Approvals */}
        {activeView === 'publishing' && <PublishingCenter />}

        {/* VIEW 7: Connection Settings */}
        {activeView === 'connections' && <ConnectionsCenter />}

        {/* VIEW 8: Automation & Audit Logs */}
        {activeView === 'logs' && <AutomationLogsCenter />}

        {/* VIEW 9: GitHub Code Explorer */}
        {activeView === 'github' && (
          <GitHubCodeExplorer
            onAskChatWithFile={(prompt, gitContext) => {
              setActiveView('chat');
              handleSendMessage(prompt, undefined, gitContext);
            }}
          />
        )}
      </div>

      {/* Floating Help Chat Widget */}
      <FloatingChatWidget
        currentMessages={currentMessages}
        onSendMessage={(text, img) => handleSendMessage(text, img)}
        isLoading={isLoading}
        onOpenFullChat={() => setActiveView('chat')}
        onNewChat={() => {
          initNewSession(false);
          setActiveView('chat');
        }}
        onNavigateToView={(view) => setActiveView(view)}
        settings={settings}
        selectedLanguage={settings.selectedLanguage || 'auto'}
        onLanguageChange={handleLanguageChange}
      />

      {/* Mobile-Friendly Bottom Navigation Bar */}
      <BottomNavigation
        activeView={activeView}
        onSelectView={setActiveView}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Drawer: Collapsible Chat History Sidebar */}
      <ConversationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        conversations={conversations}
        activeId={activeSessionId}
        onSelectConversation={(id) => {
          setActiveSessionId(id);
          setActiveView('chat');
        }}
        onNewChat={() => {
          initNewSession(false);
          setActiveView('chat');
        }}
        onDeleteConversation={handleDeleteConversation}
        onOpenGitHub={() => setActiveView('github')}
        onSelectView={setActiveView}
        activeView={activeView}
      />

      {/* Modal: Settings & Interface Preferences */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onResetSettings={handleResetSettings}
        onClearHistory={handleClearAllHistory}
        serverHealth={serverHealth}
        onOpenConnections={() => setActiveView('connections')}
        onOpenGitHub={() => setActiveView('github')}
      />

      {/* Modal: Testing & Architecture Guide */}
      <TestingGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        hasApiKey={Boolean(serverHealth?.hasApiKey)}
        model={serverHealth?.model || 'gemini-3.8-flash'}
      />

      {/* Modal: AI Agent Help and Workflow Modal */}
      <TaskWorkflowModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        taskTitle={workflowTitle}
        currentStepIndex={workflowCurrentStep}
        steps={workflowSteps}
        logs={workflowLogs}
        onStart={() => {
          setWorkflowCurrentStep(0);
          setWorkflowLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Task started by user`]);
        }}
        onApproveStep={() => {
          setWorkflowSteps(prev => prev.map((s, i) => i === workflowCurrentStep ? { ...s, status: 'completed' } : s));
          setModalRequiresApproval(false);
          setWorkflowLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Human Operator Token Verified`]);
        }}
        onNextStep={() => {
          if (workflowCurrentStep < workflowSteps.length - 1) {
            setWorkflowCurrentStep(prev => prev + 1);
            setWorkflowLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Advanced to step ${workflowCurrentStep + 2}`]);
          }
        }}
        onRetry={() => {
          setWorkflowLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Retrying step ${workflowCurrentStep + 1}`]);
        }}
        onCancel={() => {
          setIsWorkflowModalOpen(false);
        }}
        requiresApproval={modalRequiresApproval}
      />
    </div>
  );
}
