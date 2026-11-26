import React, { useState } from 'react';
import { ExternalLink, LoaderCircle, Search } from 'lucide-react';

type SearchResult = { title: string; snippet: string; url: string; domain: string };

export const LiveSearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery || loading) return;
    setLoading(true); setError(''); setSearched(false);
    try {
      const response = await fetch('/api/search?q=' + encodeURIComponent(cleanQuery), { credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Search could not be completed.');
      setResults(Array.isArray(data.results) ? data.results : []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search is temporarily unavailable.');
      setResults([]);
    } finally { setLoading(false); }
  };

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs" aria-label="Google Live Search">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center"><Search className="w-5 h-5" /></div>
        <div><h3 className="text-sm font-bold text-slate-900">Live Search</h3><p className="text-xs text-slate-500">Google Custom Search · Current web results</p></div>
      </div>
      <form onSubmit={runSearch} className="flex gap-2">
        <input value={query} onChange={event => setQuery(event.target.value)} maxLength={200} required placeholder="Search the web…" aria-label="Search the web" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
        <button type="submit" disabled={loading || !query.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}<span className="hidden sm:inline">Search</span>
        </button>
      </form>
      {error && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">{error}</p>}
      {searched && !results.length && <p className="mt-3 text-xs text-slate-500">No safe web results were returned for this query.</p>}
      {results.length > 0 && <div className="mt-4 space-y-3">{results.map((item, index) => (
        <article key={item.url + index} className="rounded-xl border border-slate-100 p-3">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 text-sm font-semibold text-emerald-900 hover:underline">{item.title}<ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" /></a>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.snippet}</p>
          <p className="mt-1 text-[10px] text-slate-400">{item.domain}</p>
        </article>
      ))}</div>}
    </section>
  );
};
