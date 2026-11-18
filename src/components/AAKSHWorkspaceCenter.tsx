import React, { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, Heart, Loader2, MessageCircle, Plus, RefreshCw, Send, ShieldCheck, Users } from 'lucide-react';
import { getCsrfHeaders } from '../utils/csrf';

type WorkspaceTask = {
  id: string; title: string; description: string; platform: string; category: string;
  status: string; approvalRequired: boolean; approvalStatus: string; createdAt: string;
};
type SocialPost = {
  id: string; userId: string; text: string; likes: number; commentsCount: number;
  likedByMe: boolean; createdAt: string;
};
type SocialComment = { id: string; userId: string; text: string; createdAt: string };
type Tab = 'work' | 'social' | 'publishing';

interface AAKSHWorkspaceCenterProps {
  onOpenTasks: () => void;
  onOpenPublishing: () => void;
}

export const AAKSHWorkspaceCenter: React.FC<AAKSHWorkspaceCenterProps> = ({ onOpenTasks, onOpenPublishing }) => {
  const [tab, setTab] = useState<Tab>('work');
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [comments, setComments] = useState<Record<string, SocialComment[]>>({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('website');
  const [category, setCategory] = useState('automation');
  const [postText, setPostText] = useState('');
  const [publishingTopic, setPublishingTopic] = useState('');
  const [publishingPlatform, setPublishingPlatform] = useState('youtube');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const loadTasks = useCallback(async () => {
    const response = await fetch('/api/aaksh/work/tasks');
    if (!response.ok) throw new Error('AAKSH work queue could not be loaded.');
    const data = await response.json();
    setTasks(Array.isArray(data.tasks) ? data.tasks : []);
  }, []);

  const loadPosts = useCallback(async () => {
    const response = await fetch('/api/aaksh/social/feed');
    if (!response.ok) throw new Error('AAKSH social feed could not be loaded.');
    const data = await response.json();
    setPosts(Array.isArray(data.posts) ? data.posts : []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setNotice('');
    try {
      await Promise.all([loadTasks(), loadPosts()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Workspace data is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [loadPosts, loadTasks]);

  useEffect(() => { void refresh(); }, [refresh]);

  const mutate = async (url: string, body: unknown) => {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'The requested action could not be completed.');
    return data;
  };

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setNotice('');
    try {
      await mutate('/api/aaksh/work/tasks', { title: title.trim(), description: description.trim(), platform, category });
      setTitle(''); setDescription('');
      setNotice('Work item saved in the shared Master Project queue. Human approval is required before execution.');
      await loadTasks();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Work item could not be saved.');
    } finally { setBusy(false); }
  };

  const createPost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!postText.trim()) return;
    setBusy(true); setNotice('');
    try {
      await mutate('/api/aaksh/social/posts', { text: postText.trim() });
      setPostText('');
      await loadPosts();
      setNotice('Post saved in this workspace.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Post could not be saved.');
    } finally { setBusy(false); }
  };

  const toggleLike = async (postId: string) => {
    setBusy(true);
    try {
      await mutate('/api/aaksh/social/posts/' + postId + '/like', {});
      await loadPosts();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Like could not be updated.');
    } finally { setBusy(false); }
  };

  const loadComments = async (postId: string) => {
    try {
      const response = await fetch('/api/aaksh/social/posts/' + postId + '/comments');
      if (!response.ok) throw new Error('Comments could not be loaded.');
      const data = await response.json();
      setComments(current => ({ ...current, [postId]: Array.isArray(data.comments) ? data.comments : [] }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Comments could not be loaded.');
    }
  };

  const addComment = async (postId: string) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    setBusy(true);
    try {
      await mutate('/api/aaksh/social/posts/' + postId + '/comments', { text });
      setCommentDrafts(current => ({ ...current, [postId]: '' }));
      await loadComments(postId);
      await loadPosts();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Comment could not be saved.');
    } finally { setBusy(false); }
  };

  const createPublishingDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!publishingTopic.trim()) return;
    setBusy(true); setNotice('');
    try {
      const data = await mutate('/api/publishing/prepare', { topic: publishingTopic.trim(), platform: publishingPlatform });
      setPublishingTopic('');
      setNotice('Draft added to the shared approval queue. Open Publishing to review it.');
      await loadTasks();
      if (data?.task?.id) setTab('publishing');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Publishing draft could not be prepared.');
    } finally { setBusy(false); }
  };

  return (
    <main className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto p-3 sm:p-5 min-w-0">
      <div className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5 shadow-xs mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-emerald-700"><ShieldCheck className="w-4 h-4" /><span className="text-[11px] font-bold uppercase tracking-wide">Integrated workspace</span></div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">AAKSH Workspace</h2>
            <p className="text-xs text-slate-500 mt-1">Uses your existing Master Project login, tenant database, task queue and approval gate.</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-emerald-50" aria-label="Refresh workspace"><RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} /></button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3"><div className="text-[10px] text-emerald-800">Work items</div><div className="text-xl font-bold text-slate-900">{tasks.length}</div></div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><div className="text-[10px] text-slate-600">Social posts</div><div className="text-xl font-bold text-slate-900">{posts.length}</div></div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3"><div className="text-[10px] text-amber-800">Awaiting approval</div><div className="text-xl font-bold text-slate-900">{tasks.filter(task => task.approvalStatus === 'pending').length}</div></div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {([{id:'work',label:'Work Tasks',icon:Activity},{id:'social',label:'Social Feed',icon:Users},{id:'publishing',label:'Publishing',icon:Send}] as const).map(item => {
          const Icon = item.icon;
          return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap border ' + (tab === item.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200') }><Icon className="w-3.5 h-3.5" />{item.label}</button>;
        })}
      </div>

      {notice && <div role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 mb-3">{notice}</div>}

      {tab === 'work' && (
        <section className="space-y-3">
          <form onSubmit={createTask} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Create AAKSH work item</h3>
            <input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required placeholder="Work item title" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            <textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} rows={3} placeholder="Describe the work (optional)" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            <div className="grid grid-cols-2 gap-2">
              <select value={platform} onChange={event => setPlatform(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><option value="website">Website</option><option value="social">Social</option><option value="youtube">YouTube</option><option value="research">Research</option><option value="automation">Automation</option></select>
              <select value={category} onChange={event => setCategory(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><option value="automation">Automation</option><option value="seo">SEO</option><option value="content">Content</option><option value="campaign">Campaign</option><option value="research">Research</option></select>
            </div>
            <button type="submit" disabled={busy || !title.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><Plus className="w-4 h-4" />{busy ? 'Saving…' : 'Save for approval'}</button>
          </form>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3"><h3 className="text-sm font-bold text-slate-900">Shared AAKSH work history</h3><button onClick={onOpenTasks} className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">Open unified queue <ArrowRight className="w-3 h-3" /></button></div>
            {tasks.length === 0 ? <p className="text-xs text-slate-500">No AAKSH work items yet.</p> : <div className="space-y-2">{tasks.map(task => <div key={task.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-xs font-semibold text-slate-900 break-words">{task.title}</div><p className="text-[11px] text-slate-500 mt-1">{task.platform} · {task.category}</p></div><span className="text-[10px] rounded-full bg-amber-100 text-amber-900 px-2 py-1 whitespace-nowrap">{task.status.replaceAll('_',' ')}</span></div><p className="text-[11px] text-slate-600 mt-2">{task.description}</p></div>)}</div>}
          </div>
        </section>
      )}

      {tab === 'social' && (
        <section className="space-y-3">
          <form onSubmit={createPost} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <h3 className="text-sm font-bold text-slate-900">Create workspace post</h3>
            <textarea value={postText} onChange={event => setPostText(event.target.value)} rows={3} maxLength={5000} required placeholder="Share an update with this workspace…" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            <button type="submit" disabled={busy || !postText.trim()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Post update</button>
          </form>
          {posts.map(post => <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{post.text}</p><div className="flex items-center gap-4 mt-3 text-xs text-slate-500"><button type="button" disabled={busy} onClick={() => void toggleLike(post.id)} className="inline-flex items-center gap-1.5"><Heart className={'w-4 h-4 ' + (post.likedByMe ? 'fill-rose-500 text-rose-500' : '')} />{post.likes}</button><button type="button" onClick={() => void loadComments(post.id)} className="inline-flex items-center gap-1.5"><MessageCircle className="w-4 h-4" />{post.commentsCount} comments</button><span>{new Date(post.createdAt).toLocaleString()}</span></div>{comments[post.id] && <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">{comments[post.id].map(comment => <p key={comment.id} className="text-xs text-slate-600">{comment.text}</p>)}<div className="flex gap-2"><input value={commentDrafts[post.id] || ''} onChange={event => setCommentDrafts(current => ({...current,[post.id]:event.target.value}))} maxLength={2000} placeholder="Write a comment…" className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-xs" /><button type="button" disabled={busy || !(commentDrafts[post.id] || '').trim()} onClick={() => void addComment(post.id)} className="rounded-lg bg-emerald-600 text-white px-3 text-xs">Send</button></div></div>}</article>)}
          {posts.length === 0 && <p className="rounded-xl bg-white border border-slate-200 p-4 text-xs text-slate-500">No workspace posts yet.</p>}
        </section>
      )}

      {tab === 'publishing' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Prepare a publishing draft</h3>
          <p className="text-xs text-slate-500">Drafts enter the same PostgreSQL approval queue. No external post is sent until an Owner/Admin approves and the configured provider confirms it.</p>
          <form onSubmit={createPublishingDraft} className="space-y-2">
            <input value={publishingTopic} onChange={event => setPublishingTopic(event.target.value)} maxLength={500} required placeholder="Topic or campaign" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <select value={publishingPlatform} onChange={event => setPublishingPlatform(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs"><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="linkedin">LinkedIn</option><option value="x">X</option></select>
            <button type="submit" disabled={busy || !publishingTopic.trim()} className="rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-xs font-semibold disabled:opacity-50">Save draft for approval</button>
          </form>
          <button type="button" onClick={onOpenPublishing} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">Open shared Publishing Center <ArrowRight className="w-3.5 h-3.5" /></button>
        </section>
      )}

      {loading && <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Loading workspace…</div>}
      <p className="mt-4 text-[10px] text-slate-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />One Master Project identity · shared tenant storage · shared approval queue</p>
    </main>
  );
};
