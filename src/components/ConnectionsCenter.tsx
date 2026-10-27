import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Bot, 
  Workflow, 
  Film, 
  Mic, 
  Share2, 
  Database, 
  Lock, 
  RefreshCw, 
  Save, 
  Radio, 
  GitBranch,
  Table,
  Mail,
  Calendar,
  FileText,
  Presentation,
  HardDrive,
  Video,
  ClipboardList,
  StickyNote,
  Users,
  Gamepad2,
  Box,
  Dna,
  Smartphone,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Layers,
  Check
} from 'lucide-react';
import { AllConnectionsStatus } from '../types';
import { SystemCapabilityRegistry, CapabilityStatus } from '../config/capabilityRegistry';

export const ConnectionsCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'connections' | 'google_workspace' | 'capabilities'>('google_workspace');
  const [connections, setConnections] = useState<AllConnectionsStatus | null>(null);
  const [registry, setRegistry] = useState<SystemCapabilityRegistry | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [hindiNotification, setHindiNotification] = useState<string | null>(null);

  // Form states for editable fields
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>('');
  const [geminiModel, setGeminiModel] = useState<string>('gemini-3.8-flash');

  const [n8nUrlInput, setN8nUrlInput] = useState<string>('');
  const [n8nTokenInput, setN8nTokenInput] = useState<string>('');

  const [videoProvider, setVideoProvider] = useState<any>('Prototype Adapter');
  const [videoEndpointInput, setVideoEndpointInput] = useState<string>('https://api.runwayml.com/v1');
  const [videoKeyInput, setVideoKeyInput] = useState<string>('');

  const [elevenLabsKeyInput, setElevenLabsKeyInput] = useState<string>('');
  const [elevenLabsVoiceInput, setElevenLabsVoiceInput] = useState<string>('21m00Tcm4TlvDq8ikWAM');

  const [publishingWebhookInput, setPublishingWebhookInput] = useState<string>('');
  const [publishingKeyInput, setPublishingKeyInput] = useState<string>('');
  const [platforms, setPlatforms] = useState({
    youtube: true,
    tiktok: true,
    x: true,
    instagram: true,
    linkedin: false
  });

  const [sheetIdInput, setSheetIdInput] = useState<string>('');
  const [sheetNameInput, setSheetNameInput] = useState<string>('AutoPilot_Records');
  const [sheetSyncEnabled, setSheetSyncEnabled] = useState<boolean>(true);

  // GitHub integration states
  const [githubTokenInput, setGithubTokenInput] = useState<string>('');
  const [githubOwnerInput, setGithubOwnerInput] = useState<string>('karotiyarohit88');
  const [githubRepoInput, setGithubRepoInput] = useState<string>('master-project-ai-agent');
  const [githubBranchInput, setGithubBranchInput] = useState<string>('main');

  // OpenAI integration states
  const [openAiKeyInput, setOpenAiKeyInput] = useState<string>('');
  const [openAiModel, setOpenAiModel] = useState<string>('gpt-4o-mini');

  // Google Workspace OAuth states
  const [workspaceClientIdInput, setWorkspaceClientIdInput] = useState<string>('');

  // Database / Firebase states
  const [databaseUrlInput, setDatabaseUrlInput] = useState<string>('');
  const [databaseProvider, setDatabaseProvider] = useState<string>('firebase');

  // Fetch status on mount
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [connRes, regRes] = await Promise.all([
        fetch('/api/connections'),
        fetch('/api/registry')
      ]);

      if (connRes.ok) {
        const data: AllConnectionsStatus = await connRes.json();
        setConnections(data);
        setGeminiModel(data.gemini.model);
        setVideoProvider(data.video.providerName);
        setVideoEndpointInput(data.video.endpoint);
        setElevenLabsVoiceInput(data.elevenlabs.selectedVoiceId);
        setPlatforms(data.publishing.enabledPlatforms);
        setSheetNameInput(data.sheets.sheetName);
        setSheetSyncEnabled(data.sheets.syncEnabled);
        if (data.github?.owner) setGithubOwnerInput(data.github.owner);
        if (data.github?.repo) setGithubRepoInput(data.github.repo);
        if (data.github?.branch) setGithubBranchInput(data.github.branch);
      }

      if (regRes.ok) {
        const regData: SystemCapabilityRegistry = await regRes.json();
        setRegistry(regData);
      }
    } catch (e) {
      console.warn('Failed to load connections or registry data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save Settings for a specific provider to server
  const handleSave = async (provider: string, config: any) => {
    try {
      const res = await fetch('/api/connections/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, config })
      });
      if (res.ok) {
        setSaveSuccess(`Settings for ${provider} saved securely to server.`);
        setHindiNotification(`गौण सेटिंग्स [${provider}] सफलतापूर्वक सुरक्षित रूप से सहेज ली गईं।`);
        fetchData();
        setTimeout(() => {
          setSaveSuccess(null);
          setHindiNotification(null);
        }, 4000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Safely Test Connection
  const handleTestConnection = async (provider: string) => {
    setTestingProvider(provider);
    setTestResult(null);
    try {
      const res = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });
      const data = await res.json();
      setTestResult({
        provider,
        success: data.success,
        message: data.message
      });
      setHindiNotification(`कनेक्शन परीक्षण [${provider}]: ${data.success ? 'सफल और सक्रिय है' : 'त्रुटि/पुनः कॉन्फ़िगरेशन की आवश्यकता है'}`);
    } catch (e: any) {
      setTestResult({
        provider,
        success: false,
        message: e?.message || 'Connection test failed.'
      });
    } finally {
      setTestingProvider(null);
    }
  };

  // Test Registry Capability Item
  const handleTestCapability = async (id: string, type: 'google_app' | 'media' | 'app_building') => {
    setTestingProvider(id);
    try {
      const res = await fetch('/api/registry/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type })
      });
      const data = await res.json();
      if (res.ok) {
        setHindiNotification(`क्षमता परीक्षण [${data.item.name}]: स्थिति "${data.item.status}" के रूप में सत्यापित की गई।`);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTestingProvider(null);
    }
  };

  const getStatusBadgeClass = (status: CapabilityStatus) => {
    switch (status) {
      case 'Working — verified':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
      case 'Connected':
        return 'bg-teal-100 text-teal-800 border-teal-300 font-bold';
      case 'Testing':
        return 'bg-sky-100 text-sky-800 border-sky-300 font-medium';
      case 'Needs configuration':
        return 'bg-amber-100 text-amber-900 border-amber-300 font-medium';
      case 'Planned':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300 font-medium';
      case 'Error':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      case 'Unavailable':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-300 font-medium';
    }
  };

  const renderGoogleAppIcon = (iconName: string) => {
    switch (iconName) {
      case 'Table': return <Table className="w-4 h-4" />;
      case 'Mail': return <Mail className="w-4 h-4" />;
      case 'Calendar': return <Calendar className="w-4 h-4" />;
      case 'FileText': return <FileText className="w-4 h-4" />;
      case 'Presentation': return <Presentation className="w-4 h-4" />;
      case 'HardDrive': return <HardDrive className="w-4 h-4" />;
      case 'Video': return <Video className="w-4 h-4" />;
      case 'ClipboardList': return <ClipboardList className="w-4 h-4" />;
      case 'StickyNote': return <StickyNote className="w-4 h-4" />;
      case 'Users': return <Users className="w-4 h-4" />;
      default: return <Layers className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-5xl w-full mx-auto p-2.5 sm:p-4 overflow-y-auto min-w-0">
      {/* Top Banner */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-2xs mb-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">Connections & Integration Registry</h2>
              <p className="text-xs text-slate-500 truncate">
                Google Workspace Apps (10 Services), AI & Media Capabilities, and Infrastructure Controls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs transition-colors cursor-pointer flex items-center gap-1"
              title="Refresh connection & registry status"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-medium">रीफ्रेश</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-4 flex items-center gap-1.5 border-b border-slate-100 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('google_workspace')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
              activeTab === 'google_workspace' 
                ? 'bg-emerald-600 text-white shadow-2xs' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Google Workspace (10)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('capabilities')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
              activeTab === 'capabilities' 
                ? 'bg-emerald-600 text-white shadow-2xs' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI, Media & App Capabilities</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('connections')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
              activeTab === 'connections' 
                ? 'bg-emerald-600 text-white shadow-2xs' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Server API Keys & Webhooks</span>
          </button>
        </div>

        {/* Hindi Notification Banner */}
        {hindiNotification && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{hindiNotification}</span>
          </div>
        )}

        {/* Test Result Message Banner */}
        {testResult && (
          <div className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2 ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <span className="font-bold uppercase text-[10px] block mb-0.5">
                [{testResult.provider}] Connection Test Result:
              </span>
              <p className="text-[11px] font-mono leading-relaxed">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Security Rule Callout */}
        <div className="mt-3 p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="truncate">
            <strong>सुरक्षित गोपनीयता:</strong> सर्वर-साइड गोपनीयता अलगाव सक्रिय है। कोई भी API Key या टोकन ब्राउज़र में उजागर नहीं होता है।
          </span>
        </div>
      </div>

      {/* TAB 1: GOOGLE WORKSPACE APPS REGISTRY */}
      {activeTab === 'google_workspace' && (
        <div className="space-y-4">
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Google Apps Integration Registry (10 Services)</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Google Workspace सेवाओं की स्थिति, आवश्यक OAuth अनुमति Scopes, समर्थित कार्य और अंतिम परीक्षण रिपोर्ट।
              </p>
            </div>
            <span className="text-[11px] font-mono font-medium px-2.5 py-1 bg-white rounded-lg border border-emerald-200 text-emerald-800">
              अंतिम सिंक: {registry?.lastUpdated ? new Date(registry.lastUpdated).toLocaleTimeString() : 'अभी'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {registry?.googleApps.map((app) => (
              <div key={app.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                      {renderGoogleAppIcon(app.iconName)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{app.name}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{app.purpose}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border ${getStatusBadgeClass(app.status)} flex-shrink-0`}>
                    {app.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs pt-1 border-t border-slate-100">
                  <div>
                    <span className="font-semibold text-slate-700 block text-[11px] mb-1">समर्थित कार्य (Supported Actions):</span>
                    <div className="flex flex-wrap gap-1">
                      {app.supportedActions.map((action, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                          {action}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-700 block text-[11px] mb-1">आवश्यक OAuth Scopes:</span>
                    <div className="space-y-0.5 max-h-16 overflow-y-auto font-mono text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                      {app.requiredScopes.map((scope, sIdx) => (
                        <div key={sIdx} className="truncate">• {scope}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px]">
                  <span className="text-slate-400 font-mono text-[10px]">
                    {app.lastTested ? `परीक्षण: ${new Date(app.lastTested).toLocaleTimeString()}` : 'अपरिक्षित'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestCapability(app.id, 'google_app')}
                      disabled={testingProvider === app.id}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Radio className="w-3 h-3" />
                      <span>{testingProvider === app.id ? 'परीक्षण...' : 'परीक्षण करें'}</span>
                    </button>
                    {app.docsUrl && (
                      <a
                        href={app.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Google API Docs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: AI, MEDIA & APP BUILDING CAPABILITIES */}
      {activeTab === 'capabilities' && (
        <div className="space-y-5">
          {/* AI & Media Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">AI तथा Media क्षमताएँ (AI & Media Capabilities)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {registry?.mediaCapabilities.map((item) => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{item.name}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{item.purpose}</p>
                    </div>
                    <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border ${getStatusBadgeClass(item.status)} flex-shrink-0`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs border-t border-slate-100 pt-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">प्रदाता (Provider):</span>
                      <span className="font-semibold text-slate-800">{item.provider}</span>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-700 block text-[11px] mb-1">समर्थित कार्य:</span>
                      <div className="flex flex-wrap gap-1">
                        {item.supportedActions.map((act, aIdx) => (
                          <span key={aIdx} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px]">
                            {act}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-slate-400 font-mono text-[10px]">
                      {item.lastTested ? `सत्यापित: ${new Date(item.lastTested).toLocaleTimeString()}` : 'सत्यापन योग्य'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTestCapability(item.id, 'media')}
                      disabled={testingProvider === item.id}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Radio className="w-3 h-3 text-emerald-600" />
                      <span>{testingProvider === item.id ? 'जाँच जारी...' : 'परीक्षण करें'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* App-Building Capabilities */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">App-Building क्षमताएँ (Games, 3D, Scientific & Android)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {registry?.appBuildingCapabilities.map((item) => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{item.name}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{item.purpose}</p>
                    </div>
                    <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border ${getStatusBadgeClass(item.status)} flex-shrink-0`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs border-t border-slate-100 pt-2">
                    <div>
                      <span className="font-semibold text-slate-700 block text-[11px] mb-1">तकनिकी ढांचा (Technologies):</span>
                      <div className="flex flex-wrap gap-1">
                        {item.technologies.map((tech, tIdx) => (
                          <span key={tIdx} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-medium border border-emerald-200">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-700 block text-[11px] mb-1">समर्थित क्षमताएँ:</span>
                      <div className="flex flex-wrap gap-1">
                        {item.supportedActions.map((act, aIdx) => (
                          <span key={aIdx} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px]">
                            {act}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-slate-400 font-mono text-[10px]">
                      {item.lastTested ? `परीक्षण: ${new Date(item.lastTested).toLocaleTimeString()}` : 'सत्यापित'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTestCapability(item.id, 'app_building')}
                      disabled={testingProvider === item.id}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Radio className="w-3 h-3 text-emerald-600" />
                      <span>{testingProvider === item.id ? 'जाँच जारी...' : 'सत्यापित करें'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SERVER API KEYS & DIRECT INTEGRATIONS */}
      {activeTab === 'connections' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          
          {/* 1. Google Gemini AI Connection */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">1. Google Gemini API</h3>
                  <p className="text-[10px] text-slate-500 truncate">Core reasoning & script generator</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                connections?.gemini.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
              }`}>
                {connections?.gemini.configured ? 'Connected' : 'Missing Key'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Model Selection</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fastest)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Server API Key Override</label>
                <input
                  type="password"
                  placeholder={connections?.gemini.configured ? '•••••••••••••••• (Active)' : 'Enter GEMINI_API_KEY'}
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                />
                <p className="text-[10px] text-slate-400">Defaults to AI Studio runtime environment secret.</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('gemini')}
                disabled={testingProvider === 'gemini'}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>{testingProvider === 'gemini' ? 'Testing...' : 'Test Connection'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('gemini', { apiKey: geminiKeyInput, model: geminiModel })}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* 2. n8n Integration */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Workflow className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">2. n8n Orchestration</h3>
                  <p className="text-[10px] text-slate-500 truncate">External automation webhook trigger</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                connections?.n8n.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {connections?.n8n.configured ? 'Configured' : 'Local Demo Mode'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">n8n Webhook URL</label>
                <input
                  type="text"
                  placeholder={connections?.n8n.endpoint || 'https://n8n.your-instance.com/webhook/...'}
                  value={n8nUrlInput}
                  onChange={(e) => setN8nUrlInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Authorization Bearer Token (Optional)</label>
                <input
                  type="password"
                  placeholder={connections?.n8n.hasAuthHeader ? '•••••••••••••••• (Saved)' : 'Bearer Token'}
                  value={n8nTokenInput}
                  onChange={(e) => setN8nTokenInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('n8n')}
                disabled={testingProvider === 'n8n'}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>{testingProvider === 'n8n' ? 'Pinging...' : 'Safe Ping'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('n8n', { webhookUrl: n8nUrlInput, authToken: n8nTokenInput })}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* 3. Video Generation Provider Adapter */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Film className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">3. Video Generation Provider</h3>
                  <p className="text-[10px] text-slate-500 truncate">Pluggable API adapter for video rendering</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                connections?.video.status === 'connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
              }`}>
                {connections?.video.status === 'connected' ? 'Connected' : 'Prototype Adapter'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Target Provider</label>
                <select
                  value={videoProvider}
                  onChange={(e) => setVideoProvider(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="Prototype Adapter">Prototype Adapter (Local Preview)</option>
                  <option value="Runway Gen-3">Runway Gen-3 API</option>
                  <option value="Luma Dream Machine">Luma Dream Machine API</option>
                  <option value="Replicate CogVideo">Replicate CogVideo API</option>
                  <option value="Custom Webhook">Custom Video Render Webhook</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Provider API Key</label>
                <input
                  type="password"
                  placeholder={connections?.video.hasApiKey ? '•••••••••••••••• (Saved)' : 'Enter Provider API Key'}
                  value={videoKeyInput}
                  onChange={(e) => setVideoKeyInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('video')}
                disabled={testingProvider === 'video'}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>{testingProvider === 'video' ? 'Testing...' : 'Test Adapter'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('video', { providerName: videoProvider, endpoint: videoEndpointInput, apiKey: videoKeyInput })}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* 4. ElevenLabs Voice API */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">4. ElevenLabs TTS API</h3>
                  <p className="text-[10px] text-slate-500 truncate">Neural text-to-speech voice engine</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                connections?.elevenlabs.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {connections?.elevenlabs.configured ? 'Connected' : 'Unconfigured'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">ElevenLabs xi-api-key</label>
                <input
                  type="password"
                  placeholder={connections?.elevenlabs.hasApiKey ? '•••••••••••••••• (Saved)' : 'Enter ElevenLabs API Key'}
                  value={elevenLabsKeyInput}
                  onChange={(e) => setElevenLabsKeyInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Default Narrator Voice</label>
                <select
                  value={elevenLabsVoiceInput}
                  onChange={(e) => setElevenLabsVoiceInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Calm Narrator)</option>
                  <option value="AZnzlk1XvdvUeBnXmlld">Domi (Dynamic Creator)</option>
                  <option value="EXAVITQu4vr4xnSDxMaL">Bella (Expressive Storytelling)</option>
                  <option value="ErXwobaYiN019PkySvjV">Antoni (Tech Executive)</option>
                  <option value="VR6AewLTigWG4xSOukaG">Arnold (Deep Announcer)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('elevenlabs')}
                disabled={testingProvider === 'elevenlabs'}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>{testingProvider === 'elevenlabs' ? 'Verifying...' : 'Test ElevenLabs'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('elevenlabs', { apiKey: elevenLabsKeyInput, selectedVoiceId: elevenLabsVoiceInput })}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* 5. Social Publishing Integrations */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">5. Social Publishing Integrations</h3>
                  <p className="text-[10px] text-slate-500 truncate">Social platform publishing adapters</p>
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex-shrink-0">
                Ready
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 block">Active Target Channels</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(platforms).map(([platform, enabled]) => (
                  <label key={platform} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setPlatforms({ ...platforms, [platform]: e.target.checked })}
                      className="accent-emerald-600 rounded"
                    />
                    <span className="capitalize font-medium text-slate-800">{platform}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-1 pt-1">
                <label className="font-semibold text-slate-700 block">Publishing Webhook Dispatcher / Gateway URL</label>
                <input
                  type="text"
                  placeholder="https://social-gateway.internal/publish"
                  value={publishingWebhookInput}
                  onChange={(e) => setPublishingWebhookInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSave('publishing', { enabledPlatforms: platforms, webhookEndpoint: publishingWebhookInput, apiKey: publishingKeyInput })}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Channels</span>
              </button>
            </div>
          </div>

          {/* 6. Optional Google Sheets Integration */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">6. Google Sheets (Telemetry Sync)</h3>
                  <p className="text-[10px] text-slate-500 truncate">Task logs, status, and output URL telemetry</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                connections?.sheets.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {connections?.sheets.configured ? 'Connected' : 'Local Memory'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Google Spreadsheet ID</label>
                <input
                  type="text"
                  placeholder={connections?.sheets.spreadsheetIdMasked || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'}
                  value={sheetIdInput}
                  onChange={(e) => setSheetIdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Target Sheet Tab</label>
                  <input
                    type="text"
                    value={sheetNameInput}
                    onChange={(e) => setSheetNameInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none text-[11px]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="syncSheetsToggle"
                    checked={sheetSyncEnabled}
                    onChange={(e) => setSheetSyncEnabled(e.target.checked)}
                    className="accent-emerald-600 rounded cursor-pointer"
                  />
                  <label htmlFor="syncSheetsToggle" className="font-medium text-slate-700 cursor-pointer">
                    Sync Telemetry
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('sheets')}
                disabled={testingProvider === 'sheets'}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>{testingProvider === 'sheets' ? 'Verifying...' : 'Validate Sheet'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('sheets', { spreadsheetId: sheetIdInput, sheetName: sheetNameInput, syncEnabled: sheetSyncEnabled })}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* 7. GitHub Repository & Code Explorer */}
          <div className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">7. GitHub Repository Integration</h3>
                  <p className="text-[10px] text-slate-500 truncate">Read-only code explorer, repo tree, and verified diff commits</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                connections?.github?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {connections?.github?.configured ? 'Connected' : 'Sandbox Mode'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Personal Access Token (PAT)</label>
                <input
                  type="password"
                  placeholder={connections?.github?.tokenMasked || 'ghp_••••••••••••••••••••••••••••••••••••'}
                  value={githubTokenInput}
                  onChange={(e) => setGithubTokenInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Owner / Org</label>
                  <input
                    type="text"
                    value={githubOwnerInput}
                    onChange={(e) => setGithubOwnerInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Repository</label>
                  <input
                    type="text"
                    value={githubRepoInput}
                    onChange={(e) => setGithubRepoInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 block">Branch</label>
                  <input
                    type="text"
                    value={githubBranchInput}
                    onChange={(e) => setGithubBranchInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none text-[11px]"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('github')}
                disabled={testingProvider === 'github'}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>{testingProvider === 'github' ? 'Verifying...' : 'Test Connection'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('github', { 
                  token: githubTokenInput, 
                  owner: githubOwnerInput, 
                  repo: githubRepoInput, 
                  branch: githubBranchInput 
                })}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* 8. OpenAI API Integration */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">8. OpenAI API Integration</h3>
                  <p className="text-[10px] text-slate-500 truncate">GPT-4o, GPT-3.5, and DALL-E fallback models</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                connections?.openai?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {connections?.openai?.configured ? 'Connected' : 'Unconfigured'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Default OpenAI Model</label>
                <select
                  value={openAiModel}
                  onChange={(e) => setOpenAiModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (Fast & Efficient)</option>
                  <option value="gpt-4o">gpt-4o (High Intelligence)</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo (Legacy)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">OpenAI API Key</label>
                <input
                  type="password"
                  placeholder={connections?.openai?.keyMasked || 'sk-proj-••••••••••••••••••••••••'}
                  value={openAiKeyInput}
                  onChange={(e) => setOpenAiKeyInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('openai')}
                disabled={testingProvider === 'openai'}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>{testingProvider === 'openai' ? 'Verifying...' : 'Test Connection'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('openai', { apiKey: openAiKeyInput, model: openAiModel })}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* 9. Google Workspace OAuth Integration */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Table className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">9. Google Workspace OAuth Client</h3>
                  <p className="text-[10px] text-slate-500 truncate">Client-side user authentication & tokens</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                connections?.workspace?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {connections?.workspace?.configured ? 'Client Ready' : 'Interactive Authorization'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">OAuth Client ID (Optional Override)</label>
                <input
                  type="text"
                  placeholder={connections?.workspace?.clientIdMasked || '••••••••.apps.googleusercontent.com'}
                  value={workspaceClientIdInput}
                  onChange={(e) => setWorkspaceClientIdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                1P Google Workspace authorization runs via secure client-side popups with Bearer header pass-through.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('workspace')}
                disabled={testingProvider === 'workspace'}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>{testingProvider === 'workspace' ? 'Verifying...' : 'Check OAuth Status'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('workspace', { clientId: workspaceClientIdInput })}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Client ID</span>
              </button>
            </div>
          </div>

          {/* 10. Database / Firebase Integration */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 min-w-0">
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">10. Database / Persistence Engine</h3>
                  <p className="text-[10px] text-slate-500 truncate">Firebase Firestore / Cloud SQL persistence</p>
                </div>
              </div>
              <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                connections?.database?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {connections?.database?.configured ? 'Connected' : 'In-Memory Persistence'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Database Provider</label>
                <select
                  value={databaseProvider}
                  onChange={(e) => setDatabaseProvider(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="firebase">Firebase Firestore (NoSQL)</option>
                  <option value="cloudsql">Cloud SQL / PostgreSQL (Relational)</option>
                  <option value="local">Local Memory Store</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Database URL / Project Config</label>
                <input
                  type="password"
                  placeholder={connections?.database?.urlMasked || 'https://firestore.googleapis.com/v1/...'}
                  value={databaseUrlInput}
                  onChange={(e) => setDatabaseUrlInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleTestConnection('database')}
                disabled={testingProvider === 'database'}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>{testingProvider === 'database' ? 'Pinging...' : 'Test Database'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave('database', { url: databaseUrlInput, provider: databaseProvider })}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Config</span>
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
