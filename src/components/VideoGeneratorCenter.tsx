import React, { useState, useEffect } from 'react';
import { 
  Video, 
  Sparkles, 
  Mic, 
  Play, 
  Clock, 
  Film, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  Layers, 
  Cpu,
  Share2,
  ExternalLink
} from 'lucide-react';
import { VideoGenerationJob, VideoConnectionStatus, ElevenLabsConnectionStatus } from '../types';

export const VideoGeneratorCenter: React.FC = () => {
  const [topic, setTopic] = useState<string>('How Modern AI Agents Work Under the Hood');
  const [duration, setDuration] = useState<number>(30);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [language, setLanguage] = useState<string>('English');
  const [selectedVoice, setSelectedVoice] = useState<string>('21m00Tcm4TlvDq8ikWAM'); // Rachel
  const [script, setScript] = useState<string>('');
  const [scenes, setScenes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<VideoGenerationJob[]>([]);
  
  // Status states
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<VideoConnectionStatus | null>(null);
  const [elevenLabsStatus, setElevenLabsStatus] = useState<ElevenLabsConnectionStatus | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Fetch provider status & past jobs
  const fetchJobsAndStatus = async () => {
    try {
      const [jobsRes, connRes] = await Promise.all([
        fetch('/api/video/jobs'),
        fetch('/api/connections')
      ]);

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs || []);
      }

      if (connRes.ok) {
        const connData = await connRes.json();
        setProviderStatus(connData.video);
        setElevenLabsStatus(connData.elevenlabs);
      }
    } catch (e) {
      console.warn('Failed to fetch video jobs:', e);
    }
  };

  useEffect(() => {
    fetchJobsAndStatus();
    const interval = setInterval(fetchJobsAndStatus, 3500);
    return () => clearInterval(interval);
  }, []);

  // 1. Generate Script via Gemini
  const handleGenerateScript = async () => {
    if (!topic.trim()) return;
    setIsGeneratingScript(true);
    setNotification(null);

    try {
      const res = await fetch('/api/video/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          duration,
          language,
          aspectRatio
        })
      });

      const data = await res.json();
      if (res.ok && data.script) {
        setScript(data.script);
        setScenes(data.scenes || []);
        setNotification({
          type: 'success',
          message: 'Script generated with scenes, narration, and visual cues using Gemini.'
        });
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to generate script.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Error communicating with script generator.' });
    } finally {
      setIsGeneratingScript(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // 2. Synthesize Voice Audio via ElevenLabs / Fallback
  const handleGenerateVoice = async () => {
    if (!script.trim()) {
      setNotification({ type: 'warning', message: 'Please generate or write a script first.' });
      return;
    }

    setIsGeneratingVoice(true);
    setNotification(null);
    setVoiceNote(null);

    try {
      const res = await fetch('/api/video/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: script,
          voiceId: selectedVoice
        })
      });

      const data = await res.json();
      if (res.ok && data.audioUrl) {
        setVoiceAudioUrl(data.audioUrl);
        if (data.message) {
          setVoiceNote(data.message);
        }
        setNotification({
          type: 'success',
          message: data.provider === 'elevenlabs' 
            ? 'ElevenLabs voice audio generated successfully.' 
            : 'Synthesized voice audio generated (Prototype mode).'
        });
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to generate voice audio.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Voice generation failed.' });
    } finally {
      setIsGeneratingVoice(false);
      setTimeout(() => setNotification(null), 4500);
    }
  };

  // 3. Submit Script and Assets to Video Provider Adapter
  const handleRenderVideo = async () => {
    if (!topic.trim() || !script.trim()) {
      setNotification({ type: 'warning', message: 'Topic and script are required to render video.' });
      return;
    }

    setIsRendering(true);
    setNotification(null);

    try {
      const res = await fetch('/api/video/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          script: script.trim(),
          language,
          duration,
          aspectRatio,
          voiceId: selectedVoice,
          scenes
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.job?.status === 'waiting_credentials') {
          setNotification({
            type: 'warning',
            message: data.message || 'Job created but provider credentials are required in Connection Settings.'
          });
        } else {
          setNotification({
            type: 'success',
            message: data.message || 'Video generation task enqueued successfully.'
          });
        }
        fetchJobsAndStatus();
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to submit render job.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Video render request failed.' });
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-5xl w-full mx-auto p-2.5 sm:p-4 overflow-y-auto min-w-0">
      {/* Top Banner */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-2xs mb-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">AI Video Generator</h2>
              <p className="text-xs text-slate-500 truncate">
                Scriptwriting with Gemini • Voice via ElevenLabs • Pluggable Video Provider Adapters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-emerald-600" />
              <span>Adapter: <strong>{providerStatus?.providerName || 'Prototype'}</strong></span>
            </span>
            <button
              type="button"
              onClick={fetchJobsAndStatus}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs transition-colors cursor-pointer"
              title="Refresh queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
            notification.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' :
            notification.type === 'warning' ? 'bg-amber-50 border border-amber-200 text-amber-900' :
            'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span className="truncate">{notification.message}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        {/* Left Column: Generator Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4 min-w-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              1. Video Parameters & Topic
            </h3>

            {/* Topic Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Topic / Concept</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Microservices vs Monolith Architecture"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none bg-slate-50"
              />
              <div className="flex gap-1.5 flex-wrap pt-1">
                {['Event-Driven Microservices', 'Quantum Computing in 2026', 'Zero-Trust Security Blueprint'].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setTopic(suggestion)}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 transition-colors cursor-pointer"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration, Aspect Ratio, Language */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Duration */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Duration</label>
                <div className="grid grid-cols-3 gap-1">
                  {[15, 30, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`py-1.5 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
                        duration === d
                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Aspect Ratio</label>
                <select
                  value={aspectRatio}
                  onChange={(e: any) => setAspectRatio(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="9:16">9:16 (Shorts / Reels)</option>
                  <option value="16:9">16:9 (Widescreen)</option>
                  <option value="1:1">1:1 (Square)</option>
                </select>
              </div>

              {/* Voice Actor */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">Voice Actor</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Calm Narrator)</option>
                  <option value="AZnzlk1XvdvUeBnXmlld">Domi (Dynamic Creator)</option>
                  <option value="EXAVITQu4vr4xnSDxMaL">Bella (Expressive)</option>
                  <option value="ErXwobaYiN019PkySvjV">Antoni (Tech Executive)</option>
                  <option value="VR6AewLTigWG4xSOukaG">Arnold (Deep Cinematic)</option>
                </select>
              </div>
            </div>

            {/* Script Action Bar */}
            <div className="pt-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 block">Video Script & Storyboard</label>
              <button
                type="button"
                onClick={handleGenerateScript}
                disabled={isGeneratingScript || !topic.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isGeneratingScript ? 'Writing with Gemini...' : 'Generate Script with Gemini'}</span>
              </button>
            </div>

            {/* Script Editor */}
            <textarea
              rows={5}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Script narration will appear here, or you can write a custom voiceover text..."
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-none bg-slate-50 leading-relaxed"
            />

            {/* Scene Breakdowns if available */}
            {scenes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Scene Storyboard ({scenes.length} Scenes)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  {scenes.map((s, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="font-bold text-emerald-800">Scene {s.sceneNumber} (~{s.durationEstimateSec}s)</span>
                      <p className="text-slate-500 text-[10px] line-clamp-2">{s.visualCue}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Voice Synthesis Action & Player */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-emerald-600" />
                  Voiceover Audio Synthesis
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {elevenLabsStatus?.configured 
                    ? 'ElevenLabs Connected • Live Neural TTS' 
                    : 'ElevenLabs not configured (Using prototype synthesizer)'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleGenerateVoice}
                  disabled={isGeneratingVoice || !script.trim()}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <Mic className="w-3 h-3 text-emerald-600" />
                  <span>{isGeneratingVoice ? 'Synthesizing...' : 'Synthesize Audio'}</span>
                </button>
              </div>
            </div>

            {/* Audio Preview if generated */}
            {voiceAudioUrl && (
              <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-center gap-2">
                <audio controls src={voiceAudioUrl} className="w-full h-8" />
              </div>
            )}
            {voiceNote && (
              <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                ℹ️ {voiceNote}
              </p>
            )}

            {/* Main Render Action */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 min-w-0 truncate">
                Target Adapter: <strong className="text-slate-800">{providerStatus?.providerName || 'Prototype'}</strong>
              </div>

              <button
                type="button"
                onClick={handleRenderVideo}
                disabled={isRendering || !script.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <Film className="w-4 h-4" />
                <span>{isRendering ? 'Enqueuing...' : 'Submit to Video Generator'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Video Gallery & Jobs Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                Render Jobs ({jobs.length})
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Live Status</span>
            </div>

            {jobs.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No video jobs yet. Generate your first video on the left.
              </div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="p-3 rounded-xl border border-slate-200 hover:border-emerald-200 transition-colors bg-slate-50/60 space-y-2.5 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-900 truncate flex-1">{job.topic}</span>
                    <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                      job.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                      job.status === 'processing' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                      job.status === 'waiting_credentials' ? 'bg-amber-100 text-amber-900' :
                      job.status === 'queued' ? 'bg-slate-200 text-slate-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {job.status === 'waiting_credentials' ? 'Needs Credentials' : job.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{job.duration}s • {job.aspectRatio} • {job.providerName}</span>
                    <span className="font-mono text-[10px]">{job.progress}%</span>
                  </div>

                  {/* Progress bar */}
                  {job.status !== 'completed' && job.status !== 'waiting_credentials' && (
                    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${job.progress}%` }} />
                    </div>
                  )}

                  {/* Missing credentials explanation */}
                  {job.status === 'waiting_credentials' && (
                    <div className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      ⚠️ {job.error}
                    </div>
                  )}

                  {/* Video Player & URL Preview */}
                  {job.status === 'completed' && job.videoUrl && (
                    <div className="space-y-2 pt-1">
                      <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-200">
                        <video
                          controls
                          poster={job.thumbnailUrl}
                          className="w-full h-full object-contain"
                          src={job.videoUrl}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <a
                          href={job.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Direct Video Asset</span>
                        </a>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {new Date(job.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
