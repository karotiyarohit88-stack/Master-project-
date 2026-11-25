import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, FlipHorizontal, Maximize, MonitorUp, Play, Square, Image as ImageIcon, Sparkles } from 'lucide-react';

type CameraSide = 'user' | 'environment';
interface Props { onAnalyze?: (imageDataUrl: string) => void; }

export const CameraMediaStudio: React.FC<Props> = ({ onAnalyze }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [side, setSide] = useState<CameraSide>('environment');
  const [active, setActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [message, setMessage] = useState('');
  const [recordedUrl, setRecordedUrl] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  };

  const startCamera = async (facing: CameraSide = side) => {
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) { setMessage('Camera access requires HTTPS and a supported browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setSide(facing); setActive(true); setMessage('Camera ready. Video stays on this device unless you choose Analyze.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Camera permission was denied or the camera is unavailable.');
    }
  };

  useEffect(() => () => { streamRef.current?.getTracks().forEach(track => track.stop()); if (recordedUrl) URL.revokeObjectURL(recordedUrl); }, [recordedUrl]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setMessage('Start the camera before taking a snapshot.'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) { setMessage('Could not capture this frame.'); return; }
    if (mirror) { context.translate(canvas.width, 0); context.scale(-1, 1); }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.86);
    setMessage('Snapshot captured locally.');
    onAnalyze?.(data);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') { setMessage('Start the camera first. Recording is not supported in this browser.'); return; }
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(URL.createObjectURL(blob));
      setMessage('Recording is ready for local playback or download.');
    };
    recorder.start(); recorderRef.current = recorder; setRecording(true);
  };

  const stopRecording = () => { recorderRef.current?.stop(); setRecording(false); };

  const theater = async () => {
    try { if (!document.fullscreenElement) await videoRef.current?.requestFullscreen?.(); else await document.exitFullscreen(); }
    catch { setMessage('Fullscreen is unavailable. Use the browser fullscreen control.'); }
  };

  const cast = async () => {
    const w = window as any;
    try {
      if (typeof w.PresentationRequest === 'function') {
        const request = new w.PresentationRequest([window.location.href]);
        const connection = await request.start();
        setMessage('Presentation session connected: ' + (connection.state || 'starting') + '. Open the Camera Studio on the receiver display.');
        return;
      }
      const video = videoRef.current as (HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void }) | null;
      if (video?.webkitShowPlaybackTargetPicker) { video.webkitShowPlaybackTargetPicker(); return; }
      setMessage('Native casting is not exposed by this browser. Use Android Cast / AirPlay from device quick settings, or open this app on the display.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Casting was cancelled or is unsupported.'); }
  };

  return <main className="flex-1 w-full max-w-5xl mx-auto overflow-y-auto p-3 sm:p-5 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div><h2 className="text-lg font-bold text-slate-900">Camera & Media Studio</h2><p className="text-xs text-slate-500 mt-1">Front/back camera, local recording, AI snapshot analysis and theater view.</p></div>
      <span className="rounded-full bg-[#14183E] text-white px-3 py-1 text-[10px] font-bold">DEVICE MEDIA</span>
    </div>
    <div className="rounded-2xl bg-[#14183E] p-2 sm:p-3 shadow-lg">
      <div className="relative overflow-hidden rounded-xl bg-black aspect-video flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" style={{ transform: mirror ? 'scaleX(-1)' : undefined }} />
        {!active && <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-2"><CameraOff size={32}/><span className="text-xs">Camera is off</span></div>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
        {!active ? <button type="button" onClick={() => void startCamera()} className="rounded-xl bg-white text-[#14183E] p-2.5 text-xs font-bold flex items-center justify-center gap-2"><Camera size={16}/>Start camera</button> : <button type="button" onClick={stopCamera} className="rounded-xl bg-white/15 text-white border border-white/30 p-2.5 text-xs font-bold flex items-center justify-center gap-2"><CameraOff size={16}/>Stop camera</button>}
        <button type="button" onClick={() => void startCamera(side === 'user' ? 'environment' : 'user')} className="rounded-xl bg-white/15 text-white border border-white/30 p-2.5 text-xs font-bold flex items-center justify-center gap-2"><FlipHorizontal size={16}/>{side === 'user' ? 'Back camera' : 'Front camera'}</button>
        <button type="button" onClick={() => setMirror(v => !v)} className="rounded-xl bg-white/15 text-white border border-white/30 p-2.5 text-xs font-bold">Mirror: {mirror ? 'ON' : 'OFF'}</button>
        <button type="button" onClick={capture} disabled={!active} className="rounded-xl bg-white text-[#14183E] p-2.5 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40"><Sparkles size={16}/>Snapshot & Analyze</button>
        {!recording ? <button type="button" onClick={startRecording} disabled={!active} className="rounded-xl bg-white/15 text-white border border-white/30 p-2.5 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40"><Play size={16}/>Record</button> : <button type="button" onClick={stopRecording} className="rounded-xl bg-red-600 text-white p-2.5 text-xs font-bold flex items-center justify-center gap-2"><Square size={16}/>Stop recording</button>}
        <button type="button" onClick={() => void theater()} className="rounded-xl bg-white/15 text-white border border-white/30 p-2.5 text-xs font-bold flex items-center justify-center gap-2"><Maximize size={16}/>Theater mode</button>
        <button type="button" onClick={() => void cast()} className="col-span-2 sm:col-span-3 rounded-xl bg-white text-[#14183E] p-2.5 text-xs font-bold flex items-center justify-center gap-2"><MonitorUp size={16}/>Cast / Project to display</button>
      </div>
    </div>
    {recordedUrl && <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center gap-2 text-xs font-bold mb-2"><ImageIcon size={15}/>Local recording</div><video controls src={recordedUrl} className="w-full max-h-64 rounded-lg bg-black"/><a href={recordedUrl} download="aaksh-camera-recording.webm" className="inline-block mt-2 text-xs font-semibold text-[#14183E] underline">Download recording</a></div>}
    {message && <p role="status" className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">{message}</p>}
    <p className="mt-3 text-[11px] text-slate-500">Privacy: camera and microphone permission are requested only after you tap Start. Recording remains local until you download it. Snapshot analysis sends the selected image to the authenticated AI chat endpoint. Browser casting support varies; Presentation API or native AirPlay picker is used only when available.</p>
  </main>;
};
