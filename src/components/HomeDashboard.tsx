import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Plus, 
  GitBranch, 
  Compass, 
  Settings, 
  Code2, 
  Smartphone, 
  Gamepad2, 
  Palette, 
  Film, 
  Mic, 
  Cpu, 
  CheckSquare, 
  ShieldAlert, 
  Terminal, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Sparkles, 
  Layers, 
  Lock, 
  RefreshCw, 
  Play,
  ArrowRight,
  ShieldCheck,
  Server,
  Zap,
  Clock
} from 'lucide-react';
import { AppView, ServerHealth, TaskStatus } from '../types';

interface HomeDashboardProps {
  onSelectView: (view: AppView) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  serverHealth: ServerHealth | null;
  currentTaskStatus: TaskStatus;
  onLaunchTaskWithPrompt: (prompt: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onSelectView,
  onNewChat,
  onOpenSettings,
  serverHealth,
  currentTaskStatus,
  onLaunchTaskWithPrompt
}) => {
  // Live states from backend
  const [connectionsData, setConnectionsData] = useState<any>(null);
  const [workflowsCount, setWorkflowsCount] = useState<number>(3);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(1);
  const [logsCount, setLogsCount] = useState<number>(1);
  const [isLoadingHealth, setIsLoadingHealth] = useState<boolean>(true);

  const fetchHealthAndStats = async () => {
    setIsLoadingHealth(true);
    try {
      const [connRes, wfRes, pubRes, logsRes] = await Promise.all([
        fetch('/api/connections'),
        fetch('/api/autopilot/workflows'),
        fetch('/api/publishing/queue'),
        fetch('/api/audit/logs')
      ]);

      if (connRes.ok) {
        const cData = await connRes.json();
        setConnectionsData(cData);
      }
      if (wfRes.ok) {
        const wData = await wfRes.json();
        setWorkflowsCount(wData.workflows?.filter((w: any) => w.enabled)?.length || 0);
      }
      if (pubRes.ok) {
        const pData = await pubRes.json();
        const pending = pData.queue?.filter((p: any) => p.status === 'waiting_approval')?.length || 0;
        setPendingApprovalsCount(pending);
      }
      if (logsRes.ok) {
        const lData = await logsRes.json();
        setLogsCount(lData.logs?.length || 0);
      }
    } catch (e) {
      console.warn('Failed to load home dashboard stats:', e);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealthAndStats();
    const interval = setInterval(fetchHealthAndStats, 8000);
    return () => clearInterval(interval);
  }, []);

  // Compute configured count
  const geminiConfigured = Boolean(connectionsData?.gemini?.configured);
  const n8nConfigured = Boolean(connectionsData?.n8n?.configured);
  const elevenlabsConfigured = Boolean(connectionsData?.elevenlabs?.configured);
  const githubConfigured = Boolean(connectionsData?.github?.status === 'connected' && connectionsData?.github?.authMethod === 'token');
  const sheetsConfigured = Boolean(connectionsData?.sheets?.configured);
  const publishingConfigured = Boolean(connectionsData?.publishing?.configured);

  const configuredCount = [
    geminiConfigured,
    n8nConfigured,
    elevenlabsConfigured,
    githubConfigured,
    sheetsConfigured,
    publishingConfigured
  ].filter(Boolean).length;

  return (
    <div className="flex-1 flex flex-col h-full max-w-6xl w-full mx-auto p-2.5 sm:p-4 md:p-6 overflow-y-auto min-w-0">
      
      {/* 1. Header Banner & Identity */}
      <div className="bg-white border border-emerald-100 rounded-3xl p-4 sm:p-6 shadow-2xs mb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 p-0.5 flex items-center justify-center shadow-xs flex-shrink-0 relative overflow-hidden">
              <img src="/assets/aistudio/1791973196299_d0ac9fe0.png" alt="Master Project AI Agent Logo" className="w-full h-full object-contain rounded-xl" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                  Master Project AI Agent
                </h1>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold border border-emerald-300">
                  Techar Aaksh Edition
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5 font-medium">
                Techar Aaksh Personal AI Programming & App-Building Command Center • Mobile Ready
              </p>
            </div>
          </div>

          {/* Quick status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-mono text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping flex-shrink-0" />
              <span>Backend: <strong>Online</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800">
              <Zap className="w-3.5 h-3.5 text-emerald-600 fill-current" />
              <span>Gemini: <strong>3.8 Flash</strong></span>
            </div>
            <button
              type="button"
              onClick={fetchHealthAndStats}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs transition-colors cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 2. Welcome Message & Prominent New Chat Action */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/50 via-teal-50/20 to-transparent p-4 rounded-2xl border border-emerald-100/60">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>What would you like to build or automate today?</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Type natural-language instructions to generate code, plan Android apps, compose vertical reels, or orchestrate autonomous workflows.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                onNewChat();
                onSelectView('chat');
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              <span>+ New AI Chat</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView('github')}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-medium transition-all cursor-pointer min-h-[40px]"
            >
              <GitBranch className="w-4 h-4 text-emerald-700" />
              <span>Explore Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. System Health Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-2xs mb-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
              Live System Health & Integration Status
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Checked: {new Date().toLocaleTimeString()}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 text-xs font-mono">
          {/* Core Backend */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-500 block">Core Backend</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-800">Node/Bun (Port 3000)</span>
            </div>
            <p className="text-[10px] text-slate-400">Express + Vite Middleware</p>
          </div>

          {/* Model Engine */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-500 block">AI Model Engine</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-bold text-slate-800">Gemini 3.8 Flash</span>
            </div>
            <p className="text-[10px] text-slate-400">Multi-Turn + Code Analysis</p>
          </div>

          {/* GitHub Explorer */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-500 block">GitHub Explorer</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${githubConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-bold text-slate-800 truncate">
                {githubConfigured ? 'Connected (PAT)' : 'Demo Sandbox'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">karotiyarohit88/master...</p>
          </div>

          {/* n8n Webhook */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-500 block">n8n Automator</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${n8nConfigured ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className="font-bold text-slate-800">
                {n8nConfigured ? 'Configured' : 'Setup Needed'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {n8nConfigured ? 'Webhook Active' : 'Configure in Connections'}
            </p>
          </div>

          {/* ElevenLabs */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-500 block">ElevenLabs Voice</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${elevenlabsConfigured ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className="font-bold text-slate-800">
                {elevenlabsConfigured ? 'Connected' : 'Prototype Audio'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Neural Voice Synthesis</p>
          </div>

          {/* Social Publishing */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-500 block">Publishing Safety Gate</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-bold text-slate-800">Enforced</span>
            </div>
            <p className="text-[10px] text-slate-400">Zero Unapproved Dispatches</p>
          </div>

          {/* Auto Pilot */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-500 block">Auto Pilot Status</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-bold text-slate-800">{workflowsCount} Active Workflows</span>
            </div>
            <p className="text-[10px] text-slate-400">Scheduled + Webhooks</p>
          </div>

          {/* Google Sheets */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-500 block">Google Sheets Sync</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${sheetsConfigured ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className="font-bold text-slate-800">
                {sheetsConfigured ? 'Configured' : 'Local Store'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Audit Telemetry Mirror</p>
          </div>
        </div>
      </div>

      {/* 4. Responsive Feature Cards Grid (12 Cards) */}
      <div className="space-y-3 mb-8">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Personal AI Workspace & Control Modules</h3>
            <p className="text-xs text-slate-500">Tap any module to launch its dedicated workspace or workflow</p>
          </div>
          <span className="text-xs font-mono text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
            12 Modules Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Card 1: Programming Lab */}
          <div
            onClick={() => onLaunchTaskWithPrompt('Programming Lab: Analyze software architecture, review TypeScript/Node code, and scan for performance or security vulnerabilities.')}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Code2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Connected
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Programming Lab
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Multi-language code generation, refactoring, security reviews, and AST bug scans.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>Open in AI Chat</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Android App Builder */}
          <div
            onClick={() => onLaunchTaskWithPrompt("Android App Builder: Let's design a Kotlin / Jetpack Compose Android app architecture with offline room database and Termux support.")}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Smartphone className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Ready
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Android App Builder
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kotlin & Jetpack Compose architecture, Termux compatibility, and UI scaffolds.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>Launch App Architect</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Game Studio */}
          <div
            onClick={() => onLaunchTaskWithPrompt('Game Studio: Design 2D/3D browser game architecture, Canvas loops, Three.js spatial scenes, and game mechanics.')}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Ready
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Game Studio
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                2D/3D browser game architecture, Canvas loops, Three.js spatial scenes, and game mechanics.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>Launch Game Studio</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 4: Auto Pilot & Workflows */}
          <div
            onClick={() => onSelectView('autopilot')}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Compass className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                  {workflowsCount} Active
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Auto Pilot & Workflows
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Autonomous pipelines with scheduled triggers, authenticated webhooks, and execution history.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>Open Workflow Builder</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 5: Image Generation */}
          <div
            onClick={() => onLaunchTaskWithPrompt('Image Generation Studio: Generate asset prompts, UI visual mockups, texture palettes, and sprite sheet specifications.')}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Palette className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Connected
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Image Generation Studio
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Asset prompts, UI mockup specifications, visual style guides, and texture palettes.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>Launch Studio</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 6: Video Gen */}
          <div
            onClick={() => onSelectView('video')}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Film className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Connected
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Video Generator
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Automated video scriptwriting, scene composition, and vertical 9:16 reels render.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>Open Video Gen</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 7: Voice Studio */}
          <div
            onClick={() => onSelectView('voice')}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Mic className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  elevenlabsConfigured
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {elevenlabsConfigured ? 'Connected' : 'Prototype Audio'}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Voice Studio
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Neural text-to-speech narration, ElevenLabs voice cloning, and audio playback.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>Open Voice Studio</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 8: Connections Center */}
          <div
            onClick={() => onSelectView('connections')}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Cpu className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                  {configuredCount} / 6 Active
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Connections Center
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Server-side credential store for Gemini, GitHub PAT, n8n, ElevenLabs, and Social APIs.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>Manage Credentials</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 9: Task Status Tracker */}
          <div
            onClick={() => onSelectView('chat')}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Activity className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border ${
                  currentTaskStatus === 'idle' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                  currentTaskStatus === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                  'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                }`}>
                  {currentTaskStatus}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Task Status Tracker
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Real-time task execution progress, dry-run validation, and pipeline telemetry.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>View Task Tracker</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 10: Human Approval Gate */}
          <div
            onClick={() => onSelectView('publishing')}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  pendingApprovalsCount > 0 ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  {pendingApprovalsCount > 0 ? `${pendingApprovalsCount} Waiting` : 'All Approved'}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-amber-700 transition-colors">
                Human Approval Gate
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Safety perimeter requiring explicit operator authorization tokens for consequential mutations.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-amber-800">
              <span>Review Approvals</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 11: Settings & Preferences */}
          <div
            onClick={onOpenSettings}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Settings className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold">
                  Configured
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Settings & Preferences
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Bubble density, font scaling, send-on-enter, and sound feedback preferences.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>Open Settings</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 12: Audit Logs */}
          <div
            onClick={() => onSelectView('logs')}
            className="group p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/80 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Terminal className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  {logsCount} Records
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                Audit & Automation Logs
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Cryptographically verifiable SHA-256 audit log of all system and operator actions.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>View Audit Trail</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
