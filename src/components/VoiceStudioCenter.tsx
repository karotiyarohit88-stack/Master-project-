import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  Volume2, 
  Play, 
  Check, 
  Sparkles, 
  RefreshCw, 
  ShieldCheck, 
  Radio, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { ElevenLabsConnectionStatus } from '../types';

export const VoiceStudioCenter: React.FC = () => {
  const [elevenLabsStatus, setElevenLabsStatus] = useState<ElevenLabsConnectionStatus | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('21m00Tcm4TlvDq8ikWAM'); // Rachel
  const [testText, setTestText] = useState<string>('Welcome to the Master Project AI Agent Voice Studio. Neural voice synthesis gives your autonomous pipelines natural, expressive narration.');
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/connections');
      if (res.ok) {
        const data = await res.json();
        setElevenLabsStatus(data.elevenlabs);
        if (data.elevenlabs?.selectedVoiceId) {
          setSelectedVoiceId(data.elevenlabs.selectedVoiceId);
        }
      }
    } catch (e) {
      console.warn('Failed to load voice settings:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSynthesize = async () => {
    if (!testText.trim()) return;
    setIsSynthesizing(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/video/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText.trim(),
          voiceId: selectedVoiceId
        })
      });

      const data = await res.json();
      if (res.ok && data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setStatusMessage({
          type: 'success',
          text: data.provider === 'elevenlabs'
            ? 'ElevenLabs high-fidelity neural audio synthesized.'
            : 'Audio synthesized via Prototype Synthesizer (ElevenLabs API key not set).'
        });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to synthesize audio.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e?.message || 'Synthesis network disruption.' });
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleTestElevenLabs = async () => {
    setStatusMessage({ type: 'info', text: 'Verifying ElevenLabs connection...' });
    try {
      const res = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'elevenlabs' })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: data.message });
      } else {
        setStatusMessage({ type: 'error', text: data.message });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e?.message || 'Test failed.' });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-5xl w-full mx-auto p-2.5 sm:p-4 overflow-y-auto min-w-0">
      {/* Top Banner */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-2xs mb-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">Voice Studio (ElevenLabs & Neural TTS)</h2>
              <p className="text-xs text-slate-500 truncate">Professional voiceover library for autonomous video narration & agent voices</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleTestElevenLabs}
              className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-600" />
              <span>Test ElevenLabs</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
            statusMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' :
            statusMessage.type === 'info' ? 'bg-slate-50 border border-slate-200 text-slate-800' :
            'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{statusMessage.text}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        {/* Left: Voice Selection Library (5 cols) */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3 min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-emerald-600" />
              Voice Personas Library
            </h3>
            <p className="text-[11px] text-slate-500">Select an active narrator for automated video generation:</p>

            <div className="space-y-2">
              {(elevenLabsStatus?.availableVoices || [
                { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm, confident, articulate narrative' },
                { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Energetic, engaging, short-form creator' },
                { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Expressive, warm, storytelling' },
                { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Authoritative, clear, corporate tech' },
                { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Deep, crisp, cinematic announcer' },
              ]).map((voice) => (
                <div
                  key={voice.id}
                  onClick={() => setSelectedVoiceId(voice.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedVoiceId === voice.id
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{voice.name}</span>
                    {selectedVoiceId === voice.id && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{voice.description}</p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Connection Status
              </p>
              <p>
                {elevenLabsStatus?.configured 
                  ? '✅ ElevenLabs API Key active on server.' 
                  : 'ℹ️ No ElevenLabs key saved. Set key in Connections tab to unlock full voice cloning.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Synthesis Tester & Audio Player (7 cols) */}
        <div className="lg:col-span-7 space-y-4 min-w-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Live Speech Synthesis & Preview
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Test Narration Script</label>
              <textarea
                rows={4}
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Type script text to preview voice..."
                className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                {testText.length} characters • ~{Math.round(testText.split(' ').length / 2.5)}s duration
              </span>

              <button
                type="button"
                onClick={handleSynthesize}
                disabled={isSynthesizing || !testText.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isSynthesizing ? 'Synthesizing...' : 'Synthesize Speech'}</span>
              </button>
            </div>

            {/* Audio Player Card */}
            {audioUrl && (
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                    Generated Audio Output
                  </span>
                  <a
                    href={audioUrl}
                    download="master_agent_voice.mp3"
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-medium"
                  >
                    Download Clip
                  </a>
                </div>
                <audio controls src={audioUrl} className="w-full h-10" autoPlay />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
