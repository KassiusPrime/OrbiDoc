import React from 'react';
import ReactMarkdown from 'react-markdown';

interface CleanMarkdownProps {
  content: string;
  className?: string;
}

export const CleanMarkdown: React.FC<CleanMarkdownProps> = ({ content, className = '' }) => {
  if (!content) return null;

  return (
    <div className={`prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-100 leading-relaxed ${className}`}>
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
          h1: ({ children }) => <h1 className="text-xl font-bold text-slate-950 dark:text-white mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold text-slate-950 dark:text-white mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold text-slate-950 dark:text-white mt-2 mb-1">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-bold text-slate-950 dark:text-white mt-2 mb-1">{children}</h4>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-500 pl-3 py-1 my-2 italic text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-r">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <pre className="p-3 my-2 bg-slate-900 text-slate-100 rounded-xl text-xs overflow-x-auto font-mono">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-xs">
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
