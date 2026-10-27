import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Send, 
  Sparkles, 
  RefreshCw, 
  ExternalLink,
  Lock,
  Layers,
  Check,
  Eye
} from 'lucide-react';
import { PublishingPost } from '../types';

export const PublishingCenter: React.FC = () => {
  const [queue, setQueue] = useState<PublishingPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string>('');
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [newTopic, setNewTopic] = useState<string>('');
  const [newPlatform, setNewPlatform] = useState<'youtube' | 'tiktok' | 'x' | 'instagram' | 'linkedin'>('youtube');
  const [notification, setNotification] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [isReviewingGate, setIsReviewingGate] = useState<boolean>(false);

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/publishing/queue');
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue || []);
        if (!selectedPostId && data.queue?.length > 0) {
          setSelectedPostId(data.queue[0].id);
        }
      }
    } catch (e) {
      console.warn('Failed to load publishing queue:', e);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 4000);
    return () => clearInterval(interval);
  }, []);

  const selectedPost = queue.find(p => p.id === selectedPostId) || queue[0] || null;

  // Prepare a new draft
  const handlePreparePost = async () => {
    if (!newTopic.trim()) return;
    try {
      const res = await fetch('/api/publishing/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: newTopic.trim(), platform: newPlatform })
      });
      if (res.ok) {
        const data = await res.json();
        setNewTopic('');
        setNotification({ type: 'success', text: `Draft post created for ${newPlatform}. Staged for human review.` });
        fetchQueue();
        setSelectedPostId(data.post.id);
      }
    } catch (e: any) {
      setNotification({ type: 'error', text: 'Failed to prepare post draft.' });
    }
  };

  // Explicit Human Operator Approval
  const handleApprove = async (postId: string) => {
    setIsApproving(true);
    setNotification(null);
    try {
      const res = await fetch('/api/publishing/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: 'success',
          text: `Post approved by human operator (Approval Token: ${data.approvalHash}). Ready to publish.`
        });
        fetchQueue();
      } else {
        setNotification({ type: 'error', text: data.error || 'Approval failed.' });
      }
    } catch (e: any) {
      setNotification({ type: 'error', text: 'Approval failed due to network disruption.' });
    } finally {
      setIsApproving(false);
    }
  };

  // Publish via platform adapter
  const handlePublish = async (postId: string) => {
    setIsPublishing(true);
    setNotification(null);
    try {
      const res = await fetch('/api/publishing/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: 'success',
          text: data.message || `Post published via verified platform adapter (${data.mode}).`
        });
        fetchQueue();
      } else {
        setNotification({
          type: 'error',
          text: data.error || 'Publishing blocked by safety gate.'
        });
      }
    } catch (e: any) {
      setNotification({ type: 'error', text: 'Publishing dispatch failed.' });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full max-w-5xl w-full mx-auto p-2.5 sm:p-4 overflow-y-auto min-w-0">
      {/* Top Banner */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-2xs mb-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">Publishing Workflow & Approval Gate</h2>
              <p className="text-xs text-slate-500 truncate">
                Multi-platform distribution with mandatory human operator authorization before publishing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Human Approval Enforced</span>
            </span>
            <button
              type="button"
              onClick={fetchQueue}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs transition-colors cursor-pointer"
              title="Refresh queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification feedback */}
        {notification && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
            notification.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' :
            notification.type === 'warning' ? 'bg-amber-50 border border-amber-200 text-amber-900' :
            'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            <span className="truncate">{notification.text}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        {/* Left Column: Post Drafts List (5 cols) */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          {/* Quick Draft Creator */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2.5 min-w-0">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Prepare New Social Post
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="Topic for post caption & hashtags..."
                className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:border-emerald-500 focus:outline-none min-w-0"
              />
              <select
                value={newPlatform}
                onChange={(e: any) => setNewPlatform(e.target.value)}
                className="text-xs px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium cursor-pointer"
              >
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="x">X / Twitter</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handlePreparePost}
              disabled={!newTopic.trim()}
              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              Prepare Post Draft
            </button>
          </div>

          {/* Queue List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                Publishing Queue ({queue.length})
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">Select to review</span>
            </div>

            {queue.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No posts in publishing queue.</p>
            ) : (
              <div className="space-y-2">
                {queue.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPostId(post.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedPost?.id === post.id
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate flex-1">{post.topic}</span>
                      <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                        post.status === 'published' ? 'bg-emerald-100 text-emerald-800' :
                        post.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                        post.status === 'waiting_approval' ? 'bg-amber-100 text-amber-900' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {post.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span className="capitalize font-medium text-emerald-800">{post.platform}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(post.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Review & Approval Gate (7 cols) */}
        <div className="lg:col-span-7 space-y-4 min-w-0">
          {selectedPost ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 min-w-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{selectedPost.topic}</h3>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                      {selectedPost.platform}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">Post ID: {selectedPost.id}</p>
                </div>
              </div>

              {/* Social Card Preview */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Platform Preview Card</span>
                  <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100/60 px-1.5 py-0.2 rounded">
                    Aspect: 9:16 / 16:9
                  </span>
                </div>

                {/* Video asset preview if present */}
                {selectedPost.videoUrl && (
                  <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                    <video
                      controls
                      poster={selectedPost.thumbnailUrl}
                      src={selectedPost.videoUrl}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {/* Caption text */}
                <div className="space-y-1">
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line bg-white p-3 rounded-xl border border-slate-200">
                    {selectedPost.caption}
                  </p>
                </div>

                {/* Hashtags */}
                {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPost.hashtags.map((tag, i) => (
                      <span key={i} className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* HUMAN APPROVAL GATE CARD IN HINDI */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-300 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-700 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                      ⚠️ मानवीय अनुमति आवश्यक है (Human Approval Gateway)
                    </h4>
                    <p className="text-[11px] text-amber-900 mt-0.5 font-medium leading-relaxed">
                      यह कार्रवाई सार्वजनिक रूप से दिखाई दे सकती है। कृपया विवरण की समीक्षा करें। आगे बढ़ने के लिए अपनी स्पष्ट अनुमति दें।
                    </p>
                  </div>
                </div>

                {selectedPost.auditReport && (
                  <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 font-mono">
                    ✅ {selectedPost.auditReport}
                  </div>
                )}

                {/* Actions Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
                  {selectedPost.status === 'waiting_approval' || selectedPost.status === 'draft' ? (
                    !isReviewingGate ? (
                      /* Step 1: First click ONLY opens review. Action is NOT executed. */
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setIsReviewingGate(true)}
                          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span>कार्रवाई की समीक्षा करें (Review Action)</span>
                        </button>
                      </div>
                    ) : (
                      /* Step 2: Second click confirms and grants approval */
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            handleApprove(selectedPost.id);
                            setIsReviewingGate(false);
                          }}
                          disabled={isApproving}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>{isApproving ? 'सत्यापन जारी है...' : 'पुष्टि करके स्वीकृति दें (Confirm & Approve)'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsReviewingGate(false)}
                          className="px-3 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-xs font-semibold transition-all cursor-pointer"
                        >
                          रद्द करें (Cancel)
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>मानवीय स्वीकृति प्रदान की गई (Operator Approved)</span>
                    </div>
                  )}

                  {/* Publish Button: Disabled until approved! */}
                  <button
                    type="button"
                    onClick={() => handlePublish(selectedPost.id)}
                    disabled={selectedPost.status !== 'approved' || isPublishing}
                    className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 ${
                      selectedPost.status === 'approved'
                        ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white cursor-pointer'
                        : selectedPost.status === 'published'
                        ? 'bg-emerald-100 text-emerald-800 cursor-default'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {isPublishing ? 'Publishing...' :
                       selectedPost.status === 'published' ? 'Published' :
                       'Publish Post Now'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
              Select a post draft on the left to review and approve.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
