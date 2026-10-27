export type TaskStatus = 
  | 'idle'
  | 'Understanding'
  | 'Planning'
  | 'Waiting for Approval'
  | 'Running'
  | 'Completed'
  | 'Failed';

export type AICategory = 
  | 'software_design'
  | 'programming'
  | 'database'
  | 'testing'
  | 'security'
  | 'deployment'
  | 'maintenance'
  | 'worker_agent'
  | 'general';

export type AppView = 
  | 'home'
  | 'chat'
  | 'agents'
  | 'tasks'
  | 'approvals'
  | 'autopilot'
  | 'video'
  | 'voice'
  | 'publishing'
  | 'connections'
  | 'logs'
  | 'github'
  | 'settings'
  | 'analytics';

export type RequestClassification = 
  | 'question'
  | 'task_execution'
  | 'code_change'
  | 'risky_action';

export interface RiskDetails {
  actionDescription: string;
  riskLevel: 'high' | 'critical' | 'medium';
  reversibility: string;
  mitigation: string;
}

export interface VerificationAudit {
  preFlightCheck: string;
  dryRunVerification: string;
  actualExecution: string;
  postFlightIntegrity: string;
}

export interface CodeChangeProposal {
  proposalId: string;
  title: string;
  description: string;
  affectedFiles: string[];
  intendedChanges: string[];
  riskLevel: 'low' | 'medium' | 'high';
  rollbackPlan: string;
  status: 'proposed' | 'applied' | 'rejected';
  validationResult?: string;
  appliedAt?: string;
  testedAt?: string;
}

export interface TaskCardData {
  taskId: string;
  type: 'video' | 'autopilot' | 'publishing' | 'voice' | 'code_proposal' | 'image';
  title: string;
  status: 'queued' | 'running' | 'completed' | 'completed_verified' | 'partially_completed' | 'failed' | 'waiting_approval' | 'not_connected' | 'not_tested';
  progress?: number;
  outputUrl?: string;
  imageUrl?: string;
  logs?: string[];
  requiresApproval?: boolean;
}

export interface WorkerAgent {
  id: string;
  name: string;
  role: string;
  avatarIcon: string;
  skills: string[];
  status: 'idle' | 'executing' | 'standby';
  description: string;
  activeMission?: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  category?: AICategory;
  status?: TaskStatus;
  classification?: RequestClassification;
  isRiskyAction?: boolean;
  riskDetails?: RiskDetails;
  isApproved?: boolean;
  isRejected?: boolean;
  verificationAudit?: VerificationAudit;
  executionHash?: string;
  error?: string;
  troubleshooting?: string[];
  executionPlan?: string[];
  integrationNote?: string;
  codeProposal?: CodeChangeProposal;
  taskCard?: TaskCardData;
}

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageItem[];
  lastCategory?: AICategory;
}

export interface ServerHealth {
  status: string;
  appName: string;
  hasApiKey: boolean;
  model: string;
  sandboxMode: string;
  activeConnectors: Record<string, string>;
}

export interface AppSettings {
  sendOnEnter: boolean;
  bubbleDensity: 'comfortable' | 'compact';
  fontSize: 'small' | 'medium' | 'large';
  showStatusTracker: boolean;
  soundEffects: boolean;
  selectedLanguage?: string;
}

export interface SupportedLanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  dir?: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: SupportedLanguageOption[] = [
  { code: 'auto', label: 'Auto Detect', nativeLabel: 'Auto Detect' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'hinglish', label: 'Hinglish', nativeLabel: 'Hinglish (Hindi + English)' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', dir: 'rtl' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ਕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文' },
];

// Connection Configuration Types
export interface GeminiConnectionStatus {
  configured: boolean;
  model: string;
  provider: string;
  status: 'connected' | 'missing_key' | 'error';
  lastTested?: string;
}

export interface N8nConnectionStatus {
  configured: boolean;
  endpoint: string;
  hasAuthHeader: boolean;
  status: 'connected' | 'unconfigured' | 'error';
  lastTested?: string;
  message?: string;
}

export interface VideoConnectionStatus {
  configured: boolean;
  providerName: 'Runway Gen-3' | 'Luma Dream Machine' | 'Replicate CogVideo' | 'Custom Webhook' | 'Prototype Adapter';
  endpoint: string;
  hasApiKey: boolean;
  status: 'connected' | 'unconfigured' | 'mock_adapter';
  lastTested?: string;
}

export interface ElevenLabsConnectionStatus {
  configured: boolean;
  hasApiKey: boolean;
  selectedVoiceId: string;
  status: 'connected' | 'unconfigured';
  availableVoices: { id: string; name: string; description: string }[];
  lastTested?: string;
}

export interface PublishingConnectionStatus {
  configured: boolean;
  enabledPlatforms: {
    youtube: boolean;
    tiktok: boolean;
    x: boolean;
    instagram: boolean;
    linkedin: boolean;
  };
  webhookEndpoint: string;
  hasCredentials: boolean;
  status: 'ready' | 'unconfigured';
}

export interface GoogleSheetsConnectionStatus {
  configured: boolean;
  spreadsheetIdMasked?: string;
  sheetName: string;
  syncEnabled: boolean;
  hasServiceAccountOrKey: boolean;
  status: 'connected' | 'unconfigured';
  lastSynced?: string;
  recordsCount?: number;
}

export interface OpenAIConnectionStatus {
  configured: boolean;
  model: string;
  keyMasked?: string;
  status: 'connected' | 'unconfigured' | 'error';
}

export interface WorkspaceOAuthConnectionStatus {
  configured: boolean;
  clientIdMasked?: string;
  scopesCount: number;
  status: 'connected' | 'interactive_required' | 'unconfigured';
}

export interface DatabaseConnectionStatus {
  configured: boolean;
  provider: string;
  urlMasked?: string;
  status: 'connected' | 'in_memory' | 'unconfigured' | 'error';
}

export interface AllConnectionsStatus {
  gemini: GeminiConnectionStatus;
  n8n: N8nConnectionStatus;
  video: VideoConnectionStatus;
  elevenlabs: ElevenLabsConnectionStatus;
  publishing: PublishingConnectionStatus;
  sheets: GoogleSheetsConnectionStatus;
  github?: GitHubConnectionStatus;
  openai?: OpenAIConnectionStatus;
  workspace?: WorkspaceOAuthConnectionStatus;
  database?: DatabaseConnectionStatus;
}

// Video Generator Types
export interface VideoGenerationJob {
  id: string;
  topic: string;
  script: string;
  language: string;
  duration: number; // in seconds (e.g. 15, 30, 60)
  aspectRatio: '9:16' | '16:9' | '1:1';
  voiceId: string;
  voiceProvider: 'elevenlabs' | 'gemini_tts' | 'prototype';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'waiting_credentials';
  progress: number; // 0 to 100
  videoUrl?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
  completedAt?: string;
  providerName: string;
  error?: string;
  scenes?: {
    sceneNumber: number;
    visualCue: string;
    narration: string;
    durationEstimateSec: number;
  }[];
}

// Auto Pilot & Trigger Types
export interface AutoPilotJob {
  id: string;
  topic: string;
  frequency: string;
  platform: string;
  language: string;
  workflow: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  logs: string[];
  retries: number;
  triggerSource: 'manual' | 'schedule' | 'webhook';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  outputArtifactUrl?: string;
}

export interface AutoPilotConfig {
  isRunning: boolean;
  topic: string;
  frequency: 'hourly' | 'every_6_hours' | 'daily' | 'manual_only';
  platform: 'youtube_shorts' | 'tiktok' | 'instagram_reels' | 'x_twitter' | 'linkedin';
  language: string;
  workflow: 'script_voice_video_approve' | 'video_direct_publish' | 'digest_review';
  webhookId: string;
  webhookSecret: string;
}

// Workflow Builder & Execution Types
export type WorkflowTriggerType = 'schedule' | 'webhook' | 'git_event' | 'manual';
export type WorkflowToolId = 'gemini_ai' | 'n8n_webhook' | 'elevenlabs_voice' | 'video_generator' | 'social_publisher' | 'google_sheets';

export interface WorkflowStep {
  id: string;
  name: string;
  toolId: WorkflowToolId;
  action: string;
  description: string;
  configured: boolean;
  requiresApproval?: boolean;
}

export interface AutoPilotWorkflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerType: WorkflowTriggerType;
  triggerConfig: {
    scheduleInterval?: 'hourly' | 'every_6_hours' | 'daily' | 'weekly';
    webhookPath?: string;
    gitEvents?: ('push' | 'pull_request')[];
    manualOnly?: boolean;
  };
  topic: string;
  targetPlatform: 'youtube_shorts' | 'tiktok' | 'instagram_reels' | 'x_twitter' | 'linkedin';
  language: string;
  tools: WorkflowToolId[];
  requireApprovalBeforePublish: boolean;
  maxRetries: number;
  steps: WorkflowStep[];
  lastRunAt?: string;
  lastStatus?: 'success' | 'failed' | 'running' | 'waiting_approval' | 'idle';
  lastError?: string;
  totalRuns: number;
  createdAt: string;
}

export interface WorkflowExecutionRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  triggerSource: WorkflowTriggerType;
  status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  progress: number;
  currentStepIndex: number;
  stepsExecuted: {
    stepId: string;
    stepName: string;
    toolId: WorkflowToolId;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_approval';
    startedAt?: string;
    completedAt?: string;
    outputSummary?: string;
    error?: string;
  }[];
  logs: string[];
  error?: string;
  approvalRequired?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  artifactUrls?: { label: string; url: string }[];
}

// Publishing Types
export interface PublishingPost {
  id: string;
  topic: string;
  platform: 'youtube' | 'tiktok' | 'x' | 'instagram' | 'linkedin';
  caption: string;
  hashtags: string[];
  videoJobId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  status: 'draft' | 'waiting_approval' | 'approved' | 'published' | 'failed';
  createdAt: string;
  approvedAt?: string;
  publishedAt?: string;
  externalPostId?: string;
  auditReport?: string;
  error?: string;
}

// Audit & Automation Logs
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: 'security' | 'approval' | 'webhook' | 'autopilot' | 'publishing' | 'video' | 'chat' | 'github';
  action: string;
  status: 'success' | 'warning' | 'error' | 'blocked' | 'info';
  details: string;
  executionHash?: string;
  ip?: string;
}

// GitHub Code Explorer Types
export interface GitHubConnectionStatus {
  configured: boolean;
  status: 'connected' | 'unconfigured' | 'rate_limited' | 'error' | 'sandbox_mode';
  authMethod: 'token' | 'oauth' | 'demo';
  userLogin: string;
  avatarUrl: string;
  owner: string;
  repo: string;
  branch: string;
  rateLimitRemaining: number;
  rateLimitLimit: number;
  lastSync: string;
  tokenMasked: string;
  scopes?: string[];
  message?: string;
}

export interface GitHubRepoItem {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  isPrivate: boolean;
  description: string;
  updatedAt: string;
  stars?: number;
}

export interface GitHubBranchItem {
  name: string;
  commitSha: string;
  isProtected: boolean;
  isDefault?: boolean;
}

export interface GitHubFileNode {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
  mode?: string;
}

export interface GitHubFileContent {
  path: string;
  name: string;
  sha: string;
  size: number;
  content: string;
  encoding: string;
  branch: string;
  isBinary: boolean;
  linesCount: number;
  downloadUrl?: string;
}

export interface GitHubSearchResult {
  path: string;
  type: 'file' | 'code';
  matches: {
    lineNumber: number;
    lineText: string;
  }[];
}

export interface GitHubCommitProposal {
  proposalId: string;
  repo: string;
  targetBranch: string;
  newBranchName?: string;
  createPullRequest: boolean;
  commitMessage: string;
  filePath: string;
  originalContent: string;
  proposedContent: string;
  diff: string;
  status: 'staged' | 'committed' | 'rejected';
  commitSha?: string;
  pullRequestUrl?: string;
  approvalToken?: string;
}

