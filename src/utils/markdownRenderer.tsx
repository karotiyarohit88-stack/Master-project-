import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface MarkdownProps {
  content: string;
  isUser?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownProps> = ({ content, isUser }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!content) return null;

  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div 
      className={`space-y-3 leading-relaxed font-sans w-full max-w-full min-w-0 overflow-hidden ${
        isUser ? 'text-white' : 'text-slate-800'
      }`}
      style={{ overflowWrap: 'anywhere' }}
    >
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const language = hasLang ? firstLine : 'code';
          const codeBody = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div key={index} className="my-2.5 rounded-xl overflow-hidden border border-emerald-900/20 bg-slate-900 text-slate-100 shadow-sm w-full max-w-full min-w-0">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 text-xs font-mono text-slate-300 border-b border-slate-800 min-w-0">
                <span className="uppercase tracking-wider font-semibold text-emerald-400 truncate">{language}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(codeBody, index)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
                  title="Copy code"
                  aria-label="Copy code snippet"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto text-xs md:text-sm font-mono text-emerald-300 bg-slate-900/95 leading-normal max-w-full scrollbar-thin scrollbar-thumb-slate-700">
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        // Render standard text lines (headings, lists, blockquotes, bold)
        const paragraphs = part.split(/\n\n+/);
        return (
          <React.Fragment key={index}>
            {paragraphs.map((para, pIdx) => {
              const trimmed = para.trim();
              if (!trimmed) return null;

              // Check for Headings
              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={pIdx} className={`text-sm sm:text-base md:text-lg font-bold mt-3 mb-1.5 flex items-center gap-1.5 flex-wrap ${isUser ? 'text-white' : 'text-emerald-950'}`}>
                    {parseInline(trimmed.substring(4), isUser)}
                  </h3>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h2 key={pIdx} className={`text-base sm:text-lg md:text-xl font-bold mt-4 mb-2 pb-1 border-b flex items-center gap-2 flex-wrap ${isUser ? 'text-white border-white/20' : 'text-slate-900 border-emerald-100'}`}>
                    {parseInline(trimmed.substring(3), isUser)}
                  </h2>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h1 key={pIdx} className={`text-lg sm:text-xl md:text-2xl font-black mt-5 mb-2.5 pb-1 border-b flex items-center gap-2 flex-wrap ${isUser ? 'text-white border-white/20' : 'text-slate-900 border-emerald-200'}`}>
                    {parseInline(trimmed.substring(2), isUser)}
                  </h1>
                );
              }

              // Check for Blockquote
              if (trimmed.startsWith('> ')) {
                const quoteText = trimmed
                  .split('\n')
                  .map((l) => (l.startsWith('> ') ? l.substring(2) : l))
                  .join('\n');
                return (
                  <blockquote
                    key={pIdx}
                    className={`border-l-4 pl-3 pr-2 py-1.5 my-2 rounded-r-lg italic text-xs sm:text-sm max-w-full ${
                      isUser
                        ? 'border-white/60 bg-white/10 text-emerald-50'
                        : 'border-emerald-500 bg-emerald-50/80 text-emerald-950'
                    }`}
                  >
                    {parseInline(quoteText, isUser)}
                  </blockquote>
                );
              }

              // Check for Lists (bullet or numbered)
              const lines = trimmed.split('\n');
              const isBulletList = lines.every((l) => /^[-*]\s/.test(l.trim()));
              const isNumberedList = lines.every((l) => /^\d+\.\s/.test(l.trim()));

              if (isBulletList) {
                return (
                  <ul key={pIdx} className="list-disc pl-4 sm:pl-5 space-y-1 my-2 max-w-full">
                    {lines.map((l, lIdx) => (
                      <li key={lIdx} className="leading-relaxed">{parseInline(l.trim().replace(/^[-*]\s+/, ''), isUser)}</li>
                    ))}
                  </ul>
                );
              }

              if (isNumberedList) {
                return (
                  <ol key={pIdx} className="list-decimal pl-4 sm:pl-5 space-y-1 my-2 max-w-full">
                    {lines.map((l, lIdx) => (
                      <li key={lIdx} className="leading-relaxed">{parseInline(l.trim().replace(/^\d+\.\s+/, ''), isUser)}</li>
                    ))}
                  </ol>
                );
              }

              // Check for Markdown Table
              if (lines.length >= 2 && lines[0].includes('|') && lines[1].includes('|') && lines[1].includes('-')) {
                const headerRow = lines[0].split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
                const bodyRows = lines.slice(2).map(row => 
                  row.split('|').map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1)
                ).filter(r => r.length > 0);

                return (
                  <div key={pIdx} className="overflow-x-auto my-2.5 rounded-xl border border-slate-200 shadow-2xs max-w-full min-w-0 scrollbar-thin scrollbar-thumb-emerald-200">
                    <table className="w-full text-left text-xs sm:text-sm min-w-[260px]">
                      <thead className="bg-emerald-50/80 text-emerald-900 uppercase font-mono text-[10px] sm:text-[11px]">
                        <tr>
                          {headerRow.map((h, hIdx) => (
                            <th key={hIdx} className="px-3 py-2 border-b border-emerald-100 font-semibold">{parseInline(h, isUser)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {bodyRows.map((bRow, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/80">
                            {bRow.map((cell, cIdx) => (
                              <td key={cIdx} className="px-3 py-1.5 text-slate-700">{parseInline(cell, isUser)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              // Standard Paragraph
              return (
                <p key={pIdx} className="leading-relaxed whitespace-pre-line max-w-full">
                  {lines.map((line, lineIdx) => (
                    <React.Fragment key={lineIdx}>
                      {lineIdx > 0 && <br />}
                      {parseInline(line, isUser)}
                    </React.Fragment>
                  ))}
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Inline parsing for **bold**, *italic*, `code`, and links with overflow protection
function parseInline(text: string, isUser?: boolean): React.ReactNode {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return tokens.map((token, i) => {
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code 
          key={i} 
          className={`px-1.5 py-0.5 rounded font-mono text-[0.85em] inline-block break-all max-w-full ${
            isUser 
              ? 'bg-emerald-700 text-white' 
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
          }`}
          style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return <strong key={i} className={`font-semibold ${isUser ? 'text-white' : 'text-slate-900'}`}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return <em key={i} className={`italic ${isUser ? 'text-emerald-100' : 'text-slate-700'}`}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}
