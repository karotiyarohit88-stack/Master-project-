import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Users, 
  Layout, 
  Server, 
  ShieldAlert, 
  Workflow, 
  Film, 
  CheckCircle2, 
  Send, 
  RefreshCw, 
  Sparkles,
  Zap
} from 'lucide-react';
import { WorkerAgent } from '../types';

export const WorkerAgentsCenter: React.FC = () => {
  const [agents, setAgents] = useState<WorkerAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [missionText, setMissionText] = useState<string>('');
  const [isDelegating, setIsDelegating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/worker-agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
        if (!selectedAgentId && data.agents?.length > 0) {
          setSelectedAgentId(data.agents[0].id);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch worker agents:', e);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDelegate = async () => {
    if (!selectedAgentId || !missionText.trim()) return;
    setIsDelegating(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/worker-agents/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          mission: missionText.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMissionText('');
        setFeedback({
          type: 'success',
          text: `Mission delegated to ${data.agent.name}. Agent status updated to executing.`
        });
        fetchAgents();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to delegate mission.' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.message || 'Network disruption.' });
    } finally {
      setIsDelegating(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const getAgentIcon = (iconName: string) => {
    switch (iconName) {
      case 'Layout': return Layout;
      case 'Server': return Server;
      case 'ShieldAlert': return ShieldAlert;
      case 'Workflow': return Workflow;
      case 'Film': return Film;
      default: return Bot;
    }
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0] || null;

  return (
    <div className="flex-1 flex flex-col h-full max-w-5xl w-full mx-auto p-2.5 sm:p-4 overflow-y-auto min-w-0">
      {/* Top Banner */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-2xs mb-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">Worker Agents Delegation Hub</h2>
              <p className="text-xs text-slate-500 truncate">
                Specialized autonomous sub-agents orchestrated by the Master Project AI Agent
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAgents}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs transition-colors cursor-pointer"
              title="Refresh worker agents"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {feedback && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
            feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{feedback.text}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        {/* Left: Agents List (5 cols) */}
        <div className="lg:col-span-5 space-y-3 min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 px-1">
            <Bot className="w-4 h-4 text-emerald-600" />
            Active Sub-Agents ({agents.length})
          </h3>

          <div className="space-y-2">
            {agents.map((agent) => {
              const Icon = getAgentIcon(agent.avatarIcon);
              const isSelected = selectedAgent?.id === agent.id;
              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100/70 text-emerald-800 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-900 truncate block">{agent.name}</span>
                        <span className="text-[10px] text-slate-500 truncate block">{agent.role}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                      agent.status === 'executing' ? 'bg-amber-100 text-amber-900 animate-pulse' :
                      agent.status === 'idle' ? 'bg-slate-100 text-slate-600' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {agent.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Agent Profile & Mission Delegation (7 cols) */}
        <div className="lg:col-span-7 space-y-4 min-w-0">
          {selectedAgent ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 min-w-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 min-w-0">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">{selectedAgent.name}</h3>
                  <p className="text-xs text-slate-500 truncate">{selectedAgent.role}</p>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  {selectedAgent.status}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {selectedAgent.description}
              </p>

              {/* Skills */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Specialized Capabilities</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAgent.skills.map((skill, idx) => (
                    <span key={idx} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Active Mission */}
              {selectedAgent.activeMission && (
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-1 text-xs">
                  <span className="font-semibold text-emerald-950 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    Current Mission
                  </span>
                  <p className="text-slate-700">{selectedAgent.activeMission}</p>
                </div>
              )}

              {/* Delegate Mission Input */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-800 block">
                  Delegate New Mission to {selectedAgent.name}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={missionText}
                    onChange={(e) => setMissionText(e.target.value)}
                    placeholder={`e.g. Audit responsive breakpoints in mobile navigation...`}
                    className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none min-w-0"
                  />
                  <button
                    type="button"
                    onClick={handleDelegate}
                    disabled={isDelegating || !missionText.trim()}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isDelegating ? 'Assigning...' : 'Assign Mission'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
              Select an agent to view details and assign missions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
