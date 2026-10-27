import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  Zap, 
  Terminal, 
  ShieldCheck, 
  Copy, 
  Check, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Share2, 
  SlidersHorizontal,
  Workflow,
  Plus,
  X,
  ChevronRight,
  Filter,
  Calendar,
  GitBranch,
  ExternalLink,
  Eye,
  Trash2,
  Sparkles,
  Lock,
  Layers
} from 'lucide-react';
import { 
  AutoPilotJob, 
  AutoPilotConfig, 
  AutoPilotWorkflow, 
  WorkflowExecutionRecord,
  WorkflowTriggerType,
  WorkflowToolId 
} from '../types';

export const AutoPilotCenter: React.FC = () => {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<'workflows' | 'history' | 'queue' | 'trigger' | 'config'>('workflows');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Data States
  const [workflows, setWorkflows] = useState<AutoPilotWorkflow[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecutionRecord[]>([]);
  const [tasks, setTasks] = useState<AutoPilotJob[]>([]);
  const [config, setConfig] = useState<AutoPilotConfig>({
    isRunning: true,
    topic: 'Next-Gen AI & Tech Architecture',
    frequency: 'every_6_hours',
    platform: 'youtube_shorts',
    language: 'English',
    workflow: 'script_voice_video_approve',
    webhookId: 'hook_master_01',
    webhookSecret: 'sec_master_01'
  });
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [webhookSecretMasked, setWebhookSecretMasked] = useState<string>('');
  const [toolsStatus, setToolsStatus] = useState<Record<string, any>>({});

  // Modals
  const [showBuilderModal, setShowBuilderModal] = useState<boolean>(false);
  const [inspectWorkflow, setInspectWorkflow] = useState<AutoPilotWorkflow | null>(null);
  const [builderStep, setBuilderStep] = useState<number>(1);

  // Builder Form State
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formTopic, setFormTopic] = useState<string>('');
  const [formPlatform, setFormPlatform] = useState<'youtube_shorts' | 'tiktok' | 'instagram_reels' | 'x_twitter' | 'linkedin'>('youtube_shorts');
  const [formLanguage, setFormLanguage] = useState<string>('English');
  const [formTriggerType, setFormTriggerType] = useState<WorkflowTriggerType>('schedule');
  const [formInterval, setFormInterval] = useState<'hourly' | 'every_6_hours' | 'daily' | 'weekly'>('every_6_hours');
  const [formTools, setFormTools] = useState<WorkflowToolId[]>(['gemini_ai', 'video_generator', 'social_publisher']);
  const [formRequireApproval, setFormRequireApproval] = useState<boolean>(true);
  const [formMaxRetries, setFormMaxRetries] = useState<number>(1);

  // Quick Action States
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [manualTopic, setManualTopic] = useState<string>('');
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false);

  // Fetch all data
  const fetchData = async () => {
    try {
      const [wfRes, execRes, qRes, cfgRes, toolsRes] = await Promise.all([
        fetch('/api/autopilot/workflows'),
        fetch('/api/autopilot/executions'),
        fetch('/api/autopilot/queue'),
        fetch('/api/autopilot/config'),
        fetch('/api/autopilot/tools-status')
      ]);

      if (wfRes.ok) {
        const wfData = await wfRes.json();
        setWorkflows(wfData.workflows || []);
      }
      if (execRes.ok) {
        const execData = await execRes.json();
        setExecutions(execData.executions || []);
      }
      if (qRes.ok) {
        const qData = await qRes.json();
        setTasks(qData.tasks || []);
      }
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setConfig(cfgData.config);
        setWebhookUrl(window.location.origin + cfgData.webhookUrl);
        setWebhookSecretMasked(cfgData.webhookSecretMasked);
      }
      if (toolsRes.ok) {
        const toolsData = await toolsRes.json();
        setToolsStatus(toolsData.tools || {});
      }
    } catch (e) {
      console.warn('Failed to load autopilot center data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Reset Builder Form
  const resetBuilder = () => {
    setBuilderStep(1);
    setFormName('');
    setFormDescription('');
    setFormTopic('High-Performance Microservices & AI');
    setFormPlatform('youtube_shorts');
    setFormLanguage('English');
    setFormTriggerType('schedule');
    setFormInterval('every_6_hours');
    setFormTools(['gemini_ai', 'video_generator', 'social_publisher']);
    setFormRequireApproval(true);
    setFormMaxRetries(1);
  };

  const handleOpenBuilder = () => {
    resetBuilder();
    setShowBuilderModal(true);
  };

  // Toggle Tool in Builder
  const toggleBuilderTool = (toolId: WorkflowToolId) => {
    if (formTools.includes(toolId)) {
      if (formTools.length === 1) return; // keep at least one tool
      setFormTools(formTools.filter(t => t !== toolId));
    } else {
      setFormTools([...formTools, toolId]);
    }
  };

  // Save New Workflow
  const handleSaveWorkflow = async () => {
    if (!formName.trim()) {
      setActionMessage({ type: 'error', text: 'Please enter a workflow name.' });
      return;
    }
    if (!formTopic.trim()) {
      setActionMessage({ type: 'error', text: 'Please specify a focus topic.' });
      return;
    }

    try {
      const res = await fetch('/api/autopilot/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim(),
          triggerType: formTriggerType,
          triggerConfig: {
            scheduleInterval: formInterval,
            manualOnly: formTriggerType === 'manual'
          },
          topic: formTopic.trim(),
          targetPlatform: formPlatform,
          language: formLanguage,
          tools: formTools,
          requireApprovalBeforePublish: formRequireApproval,
          maxRetries: formMaxRetries
        })
      });

      const data = await res.json();
      if (res.ok) {
        setShowBuilderModal(false);
        setActionMessage({ type: 'success', text: `Workflow "${data.workflow.name}" created and enabled.` });
        fetchData();
        setActiveTab('workflows');
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to save workflow.' });
      }
    } catch (e: any) {
      setActionMessage({ type: 'error', text: 'Failed to create workflow due to network error.' });
    } finally {
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Toggle Enable/Pause Workflow
  const handleToggleWorkflow = async (workflowId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/autopilot/workflows/${workflowId}/toggle`, { method: 'POST' });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Workflow
  const handleDeleteWorkflow = async (workflowId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      const res = await fetch(`/api/autopilot/workflows/${workflowId}`, { method: 'DELETE' });
      if (res.ok) {
        if (inspectWorkflow?.id === workflowId) setInspectWorkflow(null);
        setActionMessage({ type: 'success', text: 'Workflow deleted successfully.' });
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  // Execute Workflow Pipeline Immediately
  const handleRunWorkflow = async (workflowId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/autopilot/workflows/${workflowId}/run`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          type: data.execution?.approvalRequired ? 'warning' : 'success',
          text: data.execution?.approvalRequired
            ? `Workflow executed and staged at Human Approval Gate.`
            : `Workflow pipeline executed successfully.`
        });
        fetchData();
        setActiveTab('history');
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to execute workflow.' });
      }
    } catch (e: any) {
      setActionMessage({ type: 'error', text: 'Failed to run workflow.' });
    } finally {
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Approve Staged Execution
  const handleApproveExecution = async (executionId: string) => {
    try {
      const res = await fetch(`/api/autopilot/executions/${executionId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          type: 'success',
          text: `Execution approved by human operator (Token: ${data.approvalToken}). Pipeline completed.`
        });
        fetchData();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Approval failed.' });
      }
    } catch (e) {
      setActionMessage({ type: 'error', text: 'Failed to authorize execution.' });
    } finally {
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Manual Trigger Run from Queue tab
  const handleManualTrigger = async () => {
    setIsTriggering(true);
    try {
      const res = await fetch('/api/autopilot/trigger/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicOverride: manualTopic || config.topic })
      });
      const data = await res.json();
      if (res.ok) {
        setManualTopic('');
        setActionMessage({ type: 'success', text: `Auto Pilot job [${data.task.id}] started.` });
        fetchData();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to trigger task.' });
      }
    } catch (e: any) {
      setActionMessage({ type: 'error', text: 'Network error triggering task.' });
    } finally {
      setIsTriggering(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Task Actions (pause/resume/stop)
  const handleTaskAction = async (taskId: string, action: 'pause' | 'resume' | 'stop') => {
    try {
      await fetch(`/api/autopilot/queue/${taskId}/${action}`, { method: 'POST' });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Save Global Config
  const handleSaveConfig = async () => {
    try {
      const res = await fetch('/api/autopilot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Default configuration updated.' });
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (e) {
      setActionMessage({ type: 'error', text: 'Failed to save configuration.' });
    }
  };

  const curlCommand = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-autopilot-token: ${webhookSecretMasked || 'YOUR_SECRET'}" \\
  -d '{"topic": "${config.topic}", "platform": "${config.platform}"}'`;

  return (
    <div className="flex-1 flex flex-col h-full max-w-5xl w-full mx-auto p-2.5 sm:p-4 overflow-y-auto min-w-0">
      {/* Top Banner */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-2xs mb-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">Auto Pilot & Trigger Center</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex-shrink-0">
                  {workflows.filter(w => w.enabled).length} Active Workflows
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                Configure autonomous pipelines with scheduled triggers, authenticated webhooks, and execution audit history
              </p>
            </div>
          </div>

          {/* Action Header Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpenBuilder}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Auto Pilot</span>
            </button>
            <button
              type="button"
              onClick={handleManualTrigger}
              disabled={isTriggering}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Trigger default pipeline job"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600 fill-current" />
              <span>{isTriggering ? 'Running...' : 'Run Default'}</span>
            </button>
            <button
              type="button"
              onClick={fetchData}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Message Feedback */}
        {actionMessage && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
            actionMessage.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
              : actionMessage.type === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-900'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            {actionMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
            {actionMessage.type === 'warning' && <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />}
            {actionMessage.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />}
            <span className="truncate">{actionMessage.text}</span>
          </div>
        )}

        {/* Primary Navigation Tabs */}
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-100 overflow-x-auto min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('workflows')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 ${
              activeTab === 'workflows'
                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>Automations & Workflows ({workflows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Execution History ({executions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Live Task Queue ({tasks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trigger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 ${
              activeTab === 'trigger'
                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Webhook & Triggers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Global Defaults</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Workflows List */}
      {activeTab === 'workflows' && (
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2 px-1">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Configured Automation Workflows</h3>
              <p className="text-xs text-slate-500">Each workflow defines its trigger source, pipeline tools, and safety gates</p>
            </div>
            <button
              type="button"
              onClick={handleOpenBuilder}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New</span>
            </button>
          </div>

          {workflows.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
              <Workflow className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">No automation workflows created yet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Click below to build your first autonomous workflow with custom triggers and safety gates.</p>
              <button
                type="button"
                onClick={handleOpenBuilder}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Auto Pilot Workflow</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  className={`bg-white border rounded-2xl p-4 shadow-2xs transition-all space-y-3 ${
                    wf.enabled ? 'border-emerald-200 hover:border-emerald-300' : 'border-slate-200 opacity-80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">{wf.name}</span>
                        <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${
                          wf.enabled ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {wf.enabled ? 'Enabled' : 'Paused'}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                          {wf.triggerType === 'schedule' && <Calendar className="w-3 h-3 text-emerald-600" />}
                          {wf.triggerType === 'git_event' && <GitBranch className="w-3 h-3 text-indigo-600" />}
                          {wf.triggerType === 'manual' && <Zap className="w-3 h-3 text-amber-600" />}
                          <span className="capitalize">{wf.triggerType}</span>
                        </span>
                        {wf.requireApprovalBeforePublish && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Approval Gate</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{wf.description}</p>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleRunWorkflow(wf.id, e)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                        title="Execute this workflow immediately"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Run Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleToggleWorkflow(wf.id, e)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                          wf.enabled
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}
                        title={wf.enabled ? 'Pause workflow' : 'Enable workflow'}
                      >
                        {wf.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        <span>{wf.enabled ? 'Pause' : 'Enable'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setInspectWorkflow(wf)}
                        className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                        title="Inspect configuration & steps"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteWorkflow(wf.id, e)}
                        className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                        title="Delete workflow"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Pipeline Steps Chips */}
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono text-slate-600">
                    <span className="font-semibold text-slate-500 mr-1 flex-shrink-0">Pipeline:</span>
                    {wf.steps.map((st, idx) => (
                      <React.Fragment key={st.id}>
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 flex-shrink-0 flex items-center gap-1">
                          <span className="text-emerald-600 font-bold">{idx + 1}.</span>
                          <span>{st.name}</span>
                          {st.requiresApproval && <Lock className="w-2.5 h-2.5 text-amber-600 ml-0.5" />}
                        </span>
                        {idx < wf.steps.length - 1 && <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Metadata Footer */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2 font-mono flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span>Target: <strong className="text-slate-700">{wf.targetPlatform}</strong></span>
                      <span>Topic: <strong className="text-slate-700">{wf.topic}</strong></span>
                      <span>Total Runs: <strong className="text-slate-700">{wf.totalRuns}</strong></span>
                    </div>
                    <div>
                      {wf.lastRunAt && (
                        <span>Last Run: {new Date(wf.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Execution History */}
      {activeTab === 'history' && (
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2 px-1">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Workflow Execution History</h3>
              <p className="text-xs text-slate-500">Real-time status, timestamps, approval tokens, and pipeline logs</p>
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh History</span>
            </button>
          </div>

          {executions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">No execution history recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">Run an automation workflow to generate live execution records.</p>
            </div>
          ) : (
            executions.map((exec) => (
              <div key={exec.id} className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 truncate">{exec.workflowName}</span>
                      <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold border flex-shrink-0 ${
                        exec.status === 'completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        exec.status === 'running' ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse' :
                        exec.status === 'waiting_approval' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                        'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {exec.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        via {exec.triggerSource} • <code className="bg-slate-100 px-1 py-0.2 rounded">{exec.id}</code>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Started: {new Date(exec.startedAt).toLocaleTimeString()}
                      {exec.completedAt && ` • Finished: ${new Date(exec.completedAt).toLocaleTimeString()}`}
                      {exec.approvedBy && ` • Approved by: ${exec.approvedBy}`}
                    </p>
                  </div>

                  {/* Approval Action Button if waiting */}
                  {exec.status === 'waiting_approval' && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproveExecution(exec.id)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Approve & Complete</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Pipeline Progress</span>
                    <span>{exec.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        exec.status === 'completed' ? 'bg-emerald-500' :
                        exec.status === 'failed' ? 'bg-rose-500' :
                        exec.status === 'waiting_approval' ? 'bg-amber-500' :
                        'bg-emerald-600'
                      }`}
                      style={{ width: `${exec.progress}%` }}
                    />
                  </div>
                </div>

                {/* Executed Steps Grid */}
                {exec.stepsExecuted && exec.stepsExecuted.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-[11px]">
                    {exec.stepsExecuted.map((step) => (
                      <div key={step.stepId} className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-slate-800 truncate">{step.stepName}</span>
                          <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded-full ${
                            step.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                            step.status === 'waiting_approval' ? 'bg-amber-100 text-amber-900' :
                            step.status === 'running' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                            'bg-slate-200 text-slate-600'
                          }`}>
                            {step.status}
                          </span>
                        </div>
                        {step.outputSummary && (
                          <p className="text-[10px] text-slate-500 truncate">{step.outputSummary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Execution Telemetry Logs */}
                {exec.logs && exec.logs.length > 0 && (
                  <div className="bg-slate-900 rounded-xl p-3 text-slate-300 font-mono text-[11px] space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Terminal className="w-3 h-3" />
                      Pipeline Execution Logs
                    </div>
                    {exec.logs.map((log, lIdx) => (
                      <div key={lIdx} className="truncate">{log}</div>
                    ))}
                  </div>
                )}

                {/* Output Artifacts if any */}
                {exec.artifactUrls && exec.artifactUrls.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-semibold text-slate-600">Artifacts:</span>
                    {exec.artifactUrls.map((art, aIdx) => (
                      <a
                        key={aIdx}
                        href={art.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-700 hover:text-emerald-800 font-medium underline flex items-center gap-1"
                      >
                        <span>{art.label}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Live Task Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-3 min-w-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row gap-2 items-center min-w-0">
            <input
              type="text"
              value={manualTopic}
              onChange={(e) => setManualTopic(e.target.value)}
              placeholder={`Enter specific topic or leave blank for default ("${config.topic}")`}
              className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none bg-slate-50 min-w-0"
            />
            <button
              type="button"
              onClick={handleManualTrigger}
              disabled={isTriggering}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex-shrink-0 flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Task</span>
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No active tasks in queue</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate">{task.topic}</span>
                      <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                        task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        task.status === 'running' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                        task.status === 'paused' ? 'bg-slate-100 text-slate-700' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {task.status}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        via {task.triggerSource}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      Platform: <strong className="text-slate-700">{task.platform}</strong> • ID: <code className="text-[10px] bg-slate-100 px-1 py-0.2 rounded font-mono">{task.id}</code>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {task.status === 'running' && (
                      <button
                        type="button"
                        onClick={() => handleTaskAction(task.id, 'pause')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Pause className="w-3 h-3" />
                        <span>Pause</span>
                      </button>
                    )}
                    {task.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => handleTaskAction(task.id, 'resume')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Resume</span>
                      </button>
                    )}
                    {(task.status === 'running' || task.status === 'paused') && (
                      <button
                        type="button"
                        onClick={() => handleTaskAction(task.id, 'stop')}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        <span>Stop</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Execution Progress</span>
                    <span>{task.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        task.status === 'completed' ? 'bg-emerald-500' :
                        task.status === 'failed' ? 'bg-rose-500' :
                        'bg-emerald-600'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Webhook & Triggers */}
      {activeTab === 'trigger' && (
        <div className="space-y-4 min-w-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Authenticated Webhook Endpoint</h3>
                <p className="text-xs text-slate-500">Trigger Auto Pilot from external microservices, GitHub Actions, n8n, or Zapier</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Webhook URL</label>
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-slate-800 min-w-0"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer flex-shrink-0"
                >
                  {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <p className="font-semibold text-slate-800">1. Authentication Header</p>
                <p className="text-[11px] text-slate-500">Pass header <code>x-autopilot-token: [SECRET]</code>. Unauthorized requests are blocked with HTTP 401.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <p className="font-semibold text-slate-800">2. Rate Limiting</p>
                <p className="text-[11px] text-slate-500">Enforces sliding window limit of max 15 req/min with automatic duplicate detection.</p>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 block">cURL Example</label>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(curlCommand);
                    setCopiedCurl(true);
                    setTimeout(() => setCopiedCurl(false), 2000);
                  }}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 cursor-pointer"
                >
                  {copiedCurl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCurl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {curlCommand}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Global Defaults */}
      {activeTab === 'config' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 min-w-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Global Defaults</h3>
              <p className="text-xs text-slate-500">Default fallback parameters for unassigned automation tasks</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="font-semibold text-slate-700 block">Default Theme / Focus Topic</label>
              <input
                type="text"
                value={config.topic}
                onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Scheduled Trigger Frequency</label>
              <select
                value={config.frequency}
                onChange={(e: any) => setConfig({ ...config, frequency: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="hourly">Hourly (Continuous)</option>
                <option value="every_6_hours">Every 6 Hours (Recommended)</option>
                <option value="daily">Daily at 09:00 UTC</option>
                <option value="manual_only">Manual / Webhook Only</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Target Publishing Platform</label>
              <select
                value={config.platform}
                onChange={(e: any) => setConfig({ ...config, platform: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="youtube_shorts">YouTube Shorts (9:16)</option>
                <option value="tiktok">TikTok Video (9:16)</option>
                <option value="instagram_reels">Instagram Reels (9:16)</option>
                <option value="x_twitter">X / Twitter Clip (16:9)</option>
                <option value="linkedin">LinkedIn Video (1:1)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={handleSaveConfig}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              Save Defaults
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WORKFLOW BUILDER MODAL (+ Add Auto Pilot) */}
      {/* ========================================================================= */}
      {showBuilderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">Workflow Builder (+ Add Auto Pilot)</h3>
                  <p className="text-[11px] text-slate-500">Step {builderStep} of 4: {
                    builderStep === 1 ? 'Workflow Identity & Theme' :
                    builderStep === 2 ? 'Trigger & Frequency' :
                    builderStep === 3 ? 'Tools & Integrations' :
                    'Safety Gates & Pipeline Review'
                  }</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBuilderModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="w-full bg-slate-100 h-1">
              <div
                className="bg-emerald-600 h-1 transition-all duration-300"
                style={{ width: `${(builderStep / 4) * 100}%` }}
              />
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Step 1: Identity */}
              {builderStep === 1 && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-800 block">Workflow Name *</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Daily Tech Architecture Digest, GitHub PR Summary to X"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none text-slate-900 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-800 block">Focus Topic / Core Theme *</label>
                    <input
                      type="text"
                      value={formTopic}
                      onChange={(e) => setFormTopic(e.target.value)}
                      placeholder="e.g. Zero-Trust Cloud Architecture, Next.js Optimization, AI Agents"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-800 block">Target Platform</label>
                      <select
                        value={formPlatform}
                        onChange={(e: any) => setFormPlatform(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none cursor-pointer"
                      >
                        <option value="youtube_shorts">YouTube Shorts (9:16)</option>
                        <option value="tiktok">TikTok Video (9:16)</option>
                        <option value="instagram_reels">Instagram Reels (9:16)</option>
                        <option value="x_twitter">X / Twitter Clip (16:9)</option>
                        <option value="linkedin">LinkedIn Post (1:1)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-800 block">Language</label>
                      <input
                        type="text"
                        value={formLanguage}
                        onChange={(e) => setFormLanguage(e.target.value)}
                        placeholder="English, Hindi, Spanish..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-800 block">Description (Optional)</label>
                    <textarea
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Brief note on what this automation does..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none text-slate-900 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Trigger Selection */}
              {builderStep === 2 && (
                <div className="space-y-3.5">
                  <p className="text-slate-600">Choose how this automation workflow will be activated:</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Trigger: Schedule */}
                    <div
                      onClick={() => setFormTriggerType('schedule')}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        formTriggerType === 'schedule'
                          ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-bold text-slate-900">Scheduled Trigger</h4>
                      </div>
                      <p className="text-[11px] text-slate-500">Autonomous recurring cadence (cron/interval).</p>
                    </div>

                    {/* Trigger: Webhook */}
                    <div
                      onClick={() => setFormTriggerType('webhook')}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        formTriggerType === 'webhook'
                          ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-bold text-slate-900">Authenticated Webhook</h4>
                      </div>
                      <p className="text-[11px] text-slate-500">Trigger via external HTTP POST with auth token.</p>
                    </div>

                    {/* Trigger: Git Event */}
                    <div
                      onClick={() => setFormTriggerType('git_event')}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        formTriggerType === 'git_event'
                          ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <GitBranch className="w-4 h-4 text-indigo-600" />
                        <h4 className="font-bold text-slate-900">GitHub Repository Event</h4>
                      </div>
                      <p className="text-[11px] text-slate-500">Trigger on new Git commits or Pull Request proposals.</p>
                    </div>

                    {/* Trigger: Manual */}
                    <div
                      onClick={() => setFormTriggerType('manual')}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        formTriggerType === 'manual'
                          ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Zap className="w-4 h-4 text-amber-600" />
                        <h4 className="font-bold text-slate-900">Manual On-Demand</h4>
                      </div>
                      <p className="text-[11px] text-slate-500">Dispatch strictly on explicit operator click or chat command.</p>
                    </div>
                  </div>

                  {/* Trigger Configuration Specifics */}
                  {formTriggerType === 'schedule' && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <label className="font-semibold text-slate-700 block">Cadence Frequency</label>
                      <select
                        value={formInterval}
                        onChange={(e: any) => setFormInterval(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none cursor-pointer"
                      >
                        <option value="hourly">Hourly</option>
                        <option value="every_6_hours">Every 6 Hours (Recommended)</option>
                        <option value="daily">Daily at 09:00 UTC</option>
                        <option value="weekly">Weekly on Mondays</option>
                      </select>
                    </div>
                  )}

                  {formTriggerType === 'webhook' && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <p className="font-semibold text-slate-800">Webhook Authentication</p>
                      <p className="text-[11px] text-slate-500">
                        Will be accessible at <code>{webhookUrl}</code> with your existing server token.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Tool Selection & Readiness */}
              {builderStep === 3 && (
                <div className="space-y-3.5">
                  <p className="text-slate-600">Select which tools and integrations to connect to this pipeline:</p>

                  <div className="space-y-2">
                    {[
                      {
                        id: 'gemini_ai' as WorkflowToolId,
                        name: 'Google Gemini AI',
                        desc: 'Generates structured script, scene pacing, and hashtags.',
                        configured: toolsStatus.gemini_ai?.configured ?? true
                      },
                      {
                        id: 'video_generator' as WorkflowToolId,
                        name: 'Video Generator Pipeline',
                        desc: 'Composes video visual scenes and transitions.',
                        configured: true
                      },
                      {
                        id: 'elevenlabs_voice' as WorkflowToolId,
                        name: 'ElevenLabs Voice Studio',
                        desc: 'Synthesizes lifelike AI narration voiceover.',
                        configured: toolsStatus.elevenlabs_voice?.configured ?? false,
                        setupUrl: 'Settings (ElevenLabs API Key)'
                      },
                      {
                        id: 'social_publisher' as WorkflowToolId,
                        name: 'Social Media Publisher',
                        desc: 'Drafts and stages posts for social platforms (Subject to Approval Gate).',
                        configured: toolsStatus.social_publisher?.configured ?? false,
                        setupUrl: 'Connections'
                      },
                      {
                        id: 'n8n_webhook' as WorkflowToolId,
                        name: 'n8n Webhook Automator',
                        desc: 'Sends metadata payload to your n8n workflow scenario.',
                        configured: toolsStatus.n8n_webhook?.configured ?? false,
                        setupUrl: 'Connections'
                      },
                      {
                        id: 'google_sheets' as WorkflowToolId,
                        name: 'Google Sheets Audit Logger',
                        desc: 'Appends execution timestamp and hashes to spreadsheet.',
                        configured: toolsStatus.google_sheets?.configured ?? false,
                        setupUrl: 'Connections'
                      }
                    ].map((tool) => (
                      <div
                        key={tool.id}
                        onClick={() => toggleBuilderTool(tool.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          formTools.includes(tool.id)
                            ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={formTools.includes(tool.id)}
                            onChange={() => {}} // handled by parent div
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 truncate">{tool.name}</h4>
                            <p className="text-[11px] text-slate-500 truncate">{tool.desc}</p>
                          </div>
                        </div>

                        {/* Readiness Badge */}
                        <div className="flex-shrink-0">
                          {tool.configured ? (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                              Connected
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200" title={tool.setupUrl}>
                              Setup Needed
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Safety & Pipeline Review */}
              {builderStep === 4 && (
                <div className="space-y-4">
                  {/* Safety Gate Toggle */}
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-700" />
                        <h4 className="font-bold text-amber-950">Human Approval Gate (Recommended)</h4>
                      </div>
                      <input
                        type="checkbox"
                        checked={formRequireApproval}
                        onChange={(e) => setFormRequireApproval(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-amber-900/80">
                      When enabled, this workflow will automatically pause and require your explicit authorization token before publishing or dispatching externally.
                    </p>
                  </div>

                  {/* Proposed Sequence Review */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900">Proposed Execution Pipeline:</h4>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">1</span>
                        <span>Trigger: <strong>{formTriggerType.toUpperCase()}</strong> intake and parameter evaluation</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">2</span>
                        <span>Gemini AI: Synthesizes script & technical outline on "{formTopic}"</span>
                      </div>
                      {formTools.includes('video_generator') && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">3</span>
                          <span>Video Pipeline: Composes {formPlatform} video frames</span>
                        </div>
                      )}
                      {formRequireApproval && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-900">
                          <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px]">!</span>
                          <span><strong>Safety Gate:</strong> Halts pipeline and requests operator authorization token</span>
                        </div>
                      )}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">✓</span>
                        <span>Audit Log: Registers SHA-256 verification token and telemetry</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              {builderStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setBuilderStep(builderStep - 1)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBuilderModal(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-500 font-medium text-xs hover:text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              )}

              {builderStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (builderStep === 1 && (!formName.trim() || !formTopic.trim())) {
                      setActionMessage({ type: 'error', text: 'Please fill in Workflow Name and Focus Topic.' });
                      return;
                    }
                    setActionMessage(null);
                    setBuilderStep(builderStep + 1);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveWorkflow}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Save & Enable Auto Pilot</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INSPECT WORKFLOW MODAL */}
      {/* ========================================================================= */}
      {inspectWorkflow && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Workflow className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">{inspectWorkflow.name}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">ID: {inspectWorkflow.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectWorkflow(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs flex-1">
              <div className="space-y-1">
                <span className="font-semibold text-slate-500 font-mono text-[11px]">Topic Focus:</span>
                <p className="text-slate-900 font-semibold">{inspectWorkflow.topic}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block font-mono">Trigger Type</span>
                  <span className="font-bold text-slate-800 capitalize">{inspectWorkflow.triggerType}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block font-mono">Target Channel</span>
                  <span className="font-bold text-slate-800">{inspectWorkflow.targetPlatform}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block font-mono">Approval Gate</span>
                  <span className="font-bold text-amber-700">{inspectWorkflow.requireApprovalBeforePublish ? 'Enforced' : 'Direct'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block font-mono">Total Runs</span>
                  <span className="font-bold text-slate-800">{inspectWorkflow.totalRuns}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="font-semibold text-slate-700 block">Configured Pipeline Steps ({inspectWorkflow.steps.length}):</span>
                <div className="space-y-1 font-mono text-[11px]">
                  {inspectWorkflow.steps.map((s, idx) => (
                    <div key={s.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">{idx + 1}.</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{s.name}</span>
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">{s.toolId}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  handleDeleteWorkflow(inspectWorkflow.id);
                  setInspectWorkflow(null);
                }}
                className="px-3 py-1.5 rounded-xl text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
              >
                Delete Workflow
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRunWorkflow(inspectWorkflow.id);
                  setInspectWorkflow(null);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run This Workflow</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
