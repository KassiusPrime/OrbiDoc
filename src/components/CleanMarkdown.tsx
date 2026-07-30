import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check } from 'lucide-react';

interface CleanMarkdownProps {
  content: string;
  className?: string;
}

const CodeBlock: React.FC<{ language?: string; value: string }> = ({ language = 'code', value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy code', e);
    }
  };

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg font-mono text-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-slate-400 font-sans text-[11px]">
        <span className="font-semibold uppercase tracking-wider text-indigo-400">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800 text-slate-300 transition-all active:scale-95"
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto text-slate-100 leading-relaxed">
        <code>{value}</code>
      </div>
    </div>
  );
};

export const CleanMarkdown: React.FC<CleanMarkdownProps> = ({ content, className = '' }) => {
  if (!content) return null;

  return (
    <div className={`prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-100 leading-relaxed text-xs sm:text-sm ${className}`}>
      <ReactMarkdown
        components={{
          strong: ({ children }) => (
            <strong className="font-bold text-slate-950 dark:text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic text-slate-800 dark:text-slate-200">{children}</em>,
          p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 pl-1">{children}</ol>,
          li: ({ children }) => <li className="text-slate-700 dark:text-slate-200">{children}</li>,
          h1: ({ children }) => <h1 className="text-lg sm:text-xl font-bold text-slate-950 dark:text-white mt-4 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white mt-2 mb-1">{children}</h3>,
          h4: ({ children }) => <h4 className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white mt-2 mb-1">{children}</h4>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-500 pl-3.5 py-1.5 my-2.5 italic text-slate-600 dark:text-slate-300 bg-indigo-50/50 dark:bg-slate-800/40 rounded-r-lg">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-200 dark:border-slate-800">
              {children}
            </thead>
          ),
          tbody: ({ children }) => <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">{children}</tr>,
          th: ({ children }) => <th className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">{children}</th>,
          td: ({ children }) => <td className="p-2.5 text-slate-700 dark:text-slate-300">{children}</td>,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              const language = className ? className.replace('language-', '') : 'code';
              return <CodeBlock language={language} value={String(children).replace(/\n$/, '')} />;
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] sm:text-xs">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

