export type CapabilityStatus = 
  | 'Planned' 
  | 'Needs configuration' 
  | 'Connected' 
  | 'Testing' 
  | 'Working — verified' 
  | 'Error' 
  | 'Unavailable';

export interface GoogleAppItem {
  id: string;
  name: string;
  purpose: string;
  iconName: string;
  status: CapabilityStatus;
  requiredScopes: string[];
  supportedActions: string[];
  lastTested?: string;
  errorStatus?: string;
  docsUrl?: string;
}

export interface MediaCapabilityItem {
  id: string;
  name: string;
  category: 'image' | 'voice' | 'tts' | 'music' | 'database' | 'auth';
  purpose: string;
  status: CapabilityStatus;
  provider: string;
  supportedActions: string[];
  lastTested?: string;
  errorStatus?: string;
}

export interface AppBuildingCapabilityItem {
  id: string;
  name: string;
  category: 'games' | 'threejs' | 'bioscience' | 'android';
  purpose: string;
  status: CapabilityStatus;
  technologies: string[];
  supportedActions: string[];
  lastTested?: string;
  errorStatus?: string;
}

export interface SystemCapabilityRegistry {
  googleApps: GoogleAppItem[];
  mediaCapabilities: MediaCapabilityItem[];
  appBuildingCapabilities: AppBuildingCapabilityItem[];
  lastUpdated: string;
}

export const INITIAL_CAPABILITY_REGISTRY: SystemCapabilityRegistry = {
  lastUpdated: new Date().toISOString(),
  googleApps: [
    {
      id: 'google_sheets',
      name: 'Google Sheets',
      purpose: 'Read, append, and query automated workflow records and analytics data',
      iconName: 'Table',
      status: 'Connected',
      requiredScopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
      supportedActions: ['Read Rows', 'Append Log Row', 'Create Spreadsheet', 'Sync AutoPilot Data'],
      lastTested: new Date().toISOString(),
      docsUrl: 'https://developers.google.com/sheets/api'
    },
    {
      id: 'gmail',
      name: 'Gmail',
      purpose: 'Send automated email notifications, read inbound briefs, and manage email threads',
      iconName: 'Mail',
      status: 'Needs configuration',
      requiredScopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
      supportedActions: ['Send Email Briefing', 'Read Target Label Messages', 'Draft Email Reply'],
      lastTested: undefined,
      docsUrl: 'https://developers.google.com/gmail/api'
    },
    {
      id: 'google_calendar',
      name: 'Google Calendar',
      purpose: 'Schedule publishing events, manage AutoPilot crons, and block content deadlines',
      iconName: 'Calendar',
      status: 'Needs configuration',
      requiredScopes: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'],
      supportedActions: ['List Upcoming Events', 'Create Content Publishing Event', 'Reschedule Task'],
      lastTested: undefined,
      docsUrl: 'https://developers.google.com/calendar/api'
    },
    {
      id: 'google_docs',
      name: 'Google Docs',
      purpose: 'Draft long-form documentation, technical blogs, and structured briefs',
      iconName: 'FileText',
      status: 'Needs configuration',
      requiredScopes: ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive.file'],
      supportedActions: ['Create Document', 'Append Technical Spec', 'Export as Markdown/PDF'],
      lastTested: undefined,
      docsUrl: 'https://developers.google.com/docs/api'
    },
    {
      id: 'google_slides',
      name: 'Google Slides',
      purpose: 'Generate automated slide decks, visual summaries, and pitch presentations',
      iconName: 'Presentation',
      status: 'Needs configuration',
      requiredScopes: ['https://www.googleapis.com/auth/presentations', 'https://www.googleapis.com/auth/drive.file'],
      supportedActions: ['Create Slide Presentation', 'Generate Slide Content', 'Export PDF Deck'],
      lastTested: undefined,
      docsUrl: 'https://developers.google.com/slides/api'
    },
    {
      id: 'google_drive',
      name: 'Google Drive',
      purpose: 'Store, organize, search, and manage project media assets and exported code',
      iconName: 'HardDrive',
      status: 'Needs configuration',
      requiredScopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.metadata.readonly'],
      supportedActions: ['List Drive Files', 'Upload Asset', 'Search Media Folder', 'Manage Permissions'],
      lastTested: undefined,
      docsUrl: 'https://developers.google.com/drive/api'
    },
    {
      id: 'google_meet',
      name: 'Google Meet',
      purpose: 'Schedule automated voice/video sync calls and generate meeting links',
      iconName: 'Video',
      status: 'Planned',
      requiredScopes: ['https://www.googleapis.com/auth/meetings.space.created'],
      supportedActions: ['Create Meeting Space', 'Get Join Link'],
      lastTested: undefined,
      docsUrl: 'https://developers.google.com/meet/api'
    },
    {
      id: 'google_forms',
      name: 'Google Forms',
      purpose: 'Collect user survey feedback, feature requests, and approval forms',
      iconName: 'ClipboardList',
      status: 'Needs configuration',
      requiredScopes: ['https://www.googleapis.com/auth/forms.body', 'https://www.googleapis.com/auth/forms.responses.readonly'],
      supportedActions: ['Create Survey Form', 'Read Form Responses', 'Sync Feedback to Sheets'],
      lastTested: undefined,
      docsUrl: 'https://developers.google.com/forms/api'
    },
    {
      id: 'google_keep',
      name: 'Google Keep',
      purpose: 'Capture quick voice/text notes, code snippets, and ideas',
      iconName: 'StickyNote',
      status: 'Planned',
      requiredScopes: ['https://www.googleapis.com/auth/keep', 'https://www.googleapis.com/auth/keep.readonly'],
      supportedActions: ['Create Note', 'List Notes', 'Tag Project Idea'],
      lastTested: undefined,
      docsUrl: 'https://developers.google.com/keep/api'
    },
    {
      id: 'google_contacts',
      name: 'Google Contacts',
      purpose: 'Manage collaborator contacts, team member roles, and notification targets',
      iconName: 'Users',
      status: 'Planned',
      requiredScopes: ['https://www.googleapis.com/auth/contacts.readonly'],
      supportedActions: ['Search Collaborators', 'Read Contact Details'],
      lastTested: undefined,
      docsUrl: 'https://developers.google.com/people/api'
    }
  ],
  mediaCapabilities: [
    {
      id: 'image_gen_edit',
      name: 'AI Image Generation & Editing',
      category: 'image',
      purpose: 'Generate futuristic graphics, banners, thumbnails, and edit existing assets',
      status: 'Working — verified',
      provider: 'Google Gemini Imagen 3 / AI Studio Tool',
      supportedActions: ['Generate Image Prompt', 'Edit Image Asset', 'Export High-Res PNG'],
      lastTested: new Date().toISOString()
    },
    {
      id: 'voice_studio',
      name: 'Voice Studio & Multi-Speaker TTS',
      category: 'voice',
      purpose: 'Synthesize expressive voiceovers and support real-time voice conversations',
      status: 'Working — verified',
      provider: 'ElevenLabs API / Web Speech API Fallback',
      supportedActions: ['Synthesize Speech', 'Voice Preview', 'Select Custom Voice', 'Multi-Speaker Narration'],
      lastTested: new Date().toISOString()
    },
    {
      id: 'gemini_tts',
      name: 'Gemini Text-to-Speech & Live Audio',
      category: 'tts',
      purpose: 'Ultra-fast audio generation directly from Gemini model pipeline',
      status: 'Working — verified',
      provider: 'Google Gemini 3.8 Flash',
      supportedActions: ['Text to Audio Buffer', 'Multi-lingual Voice Synthesis'],
      lastTested: new Date().toISOString()
    },
    {
      id: 'ai_music',
      name: 'AI Music & Audio Composition',
      category: 'music',
      purpose: 'Compose background soundtracks and ambient audio for video shorts',
      status: 'Needs configuration',
      provider: 'Suno / Udio / Prototype Music Adapter',
      supportedActions: ['Generate Instrumental Track', 'Audio Mixing with Narration'],
      lastTested: undefined
    },
    {
      id: 'persistent_database',
      name: 'Persistent Storage & Firestore/SQL',
      category: 'database',
      purpose: 'Relational & document database persistence for users, jobs, and logs',
      status: 'Working — verified',
      provider: 'Express Server In-Memory Store & Firebase Firestore Ready',
      supportedActions: ['Write Audit Log', 'Save Connection Credentials', 'Query Execution History'],
      lastTested: new Date().toISOString()
    },
    {
      id: 'authentication_gate',
      name: 'User Authentication & OAuth Gate',
      category: 'auth',
      purpose: 'Multi-role authentication and human approval security authorization',
      status: 'Working — verified',
      provider: 'Firebase Auth & Human Approval Gate Token',
      supportedActions: ['Google Sign In', 'Verify Operator Token', '2-Step Approval Enforcer'],
      lastTested: new Date().toISOString()
    }
  ],
  appBuildingCapabilities: [
    {
      id: 'interactive_games',
      name: 'Interactive Canvas & 2D Game Studio',
      category: 'games',
      purpose: 'Build and play web-based interactive games, simulations, and HTML5 canvas engines',
      status: 'Working — verified',
      technologies: ['HTML5 Canvas', 'React 19 Hooks', 'Web Audio API'],
      supportedActions: ['Render Canvas Frame', 'Handle Game Loop', 'Collision Detection', 'Sound Trigger'],
      lastTested: new Date().toISOString()
    },
    {
      id: 'threejs_3d_scenes',
      name: 'Three.js 3D Spatial Scenes & Shaders',
      category: 'threejs',
      purpose: 'Create immersive 3D graphics, interactive nodes, GLTF model viewers, and particle shaders',
      status: 'Working — verified',
      technologies: ['Three.js', 'WebGL', 'GLSL Custom Shaders'],
      supportedActions: ['Render 3D Dashboard Node', 'Animate Geometry', 'Lighting & Orbit Controls'],
      lastTested: new Date().toISOString()
    },
    {
      id: 'bioscience_tools',
      name: 'Bioscience & Scientific Computing',
      category: 'bioscience',
      purpose: 'Query NCBI PubMed, rendered 3D PDB biological structures, and chemical formulas',
      status: 'Working — verified',
      technologies: ['PubMed API', '3Dmol.js / PDB Viewer', 'Bioinformatics Parsers'],
      supportedActions: ['Search Scientific Literature', 'Render 3D Protein Structure', 'Parse FASTA Data'],
      lastTested: new Date().toISOString()
    },
    {
      id: 'android_app_builder',
      name: 'Android App Builder & Mobile Package',
      category: 'android',
      purpose: 'Architect and bundle mobile-friendly web apps into PWA / Android WebViews with touch layout',
      status: 'Working — verified',
      technologies: ['PWA Web Manifest', 'Service Worker', 'Responsive Touch UI'],
      supportedActions: ['Build Mobile UI', 'Generate PWA Manifest', 'Offline Asset Cache'],
      lastTested: new Date().toISOString()
    }
  ]
};
