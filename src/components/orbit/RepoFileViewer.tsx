import React, { useMemo } from 'react';

/**
 * Visualizador de código somente leitura com numeração de linhas.
 *
 * Nota de arquitetura: o guia sugere `@monaco-editor/react`. Optamos por um
 * highlight próprio atrás desta fronteira de componente porque o loader padrão
 * do Monaco busca o runtime de um CDN — o que quebraria o produto offline-first
 * (PWA com precache, verificado por `verify:pwa`) e somaria ~5 MB ao bundle.
 * Trocar o miolo deste arquivo por Monaco/CodeMirror não afeta a surface.
 */

const KEYWORDS = /\b(import|export|from|default|const|let|var|function|return|if|else|for|while|class|extends|new|await|async|try|catch|finally|throw|typeof|instanceof|interface|type|enum|implements|public|private|protected|static|readonly|def|end|do|then|elif|elif|elif|switch|case|break|continue|in|of|is|not|and|or|nil|None|True|False|true|false|null|undefined|void|self|this|super|yield|lambda|with|as|pass|raise|struct|package|func|go|defer|map|chan|range|using|namespace|record|sealed|partial|fn|impl|trait|pub|mut|use|match|where|module|require)\b/;
const COMMENT_LINE = /(\/\/[^\n]*|#[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/)/;

const tokenize = (line: string): React.ReactNode => {
  const nodes: React.ReactNode[] = [];
  let rest = line;
  let key = 0;

  // Comentário domina o resto da linha.
  const commentIndex = rest.search(COMMENT_LINE);
  let trailing: string | null = null;
  if (commentIndex >= 0) {
    trailing = rest.slice(commentIndex);
    rest = rest.slice(0, commentIndex);
  }

  const pattern = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+|[^\w\s])/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(rest)) !== null) {
    const [text, string, number, word] = match;
    if (string) nodes.push(<span key={key++} className="text-emerald-600 dark:text-emerald-400">{text}</span>);
    else if (number) nodes.push(<span key={key++} className="text-amber-600 dark:text-amber-400">{text}</span>);
    else if (word) {
      if (KEYWORDS.test(word)) nodes.push(<span key={key++} className="text-violet-600 dark:text-violet-400">{text}</span>);
      else if (/^[A-Z]/.test(word)) nodes.push(<span key={key++} className="text-blue-700 dark:text-blue-300">{text}</span>);
      else nodes.push(<span key={key++}>{text}</span>);
    } else nodes.push(<span key={key++}>{text}</span>);
  }

  if (trailing) nodes.push(<span key={key++} className="text-slate-400 dark:text-slate-500 italic">{trailing}</span>);
  return nodes;
};

interface Props {
  content: string;
  /** Caminho exibido no cabeçalho do viewer. */
  path: string;
  /** Linguagem detectada, exibida como rótulo. */
  language?: string;
  truncated?: boolean;
  busy?: boolean;
  error?: string;
}

export const RepoFileViewer: React.FC<Props> = ({ content, path, language, truncated, busy, error }) => {
  const lines = useMemo(() => content.replace(/\r\n/g, '\n').split('\n'), [content]);
  const gutterWidth = `${String(lines.length).length + 1}ch`;

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white dark:bg-[#0B1220] overflow-hidden">
      <div className="shrink-0 h-8 px-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-[10px]">
        <span className="font-medium truncate text-slate-600 dark:text-slate-300" title={path}>{path.split('/').pop() || path}</span>
        {language ? <span className="shrink-0 rounded px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase tracking-wide">{language}</span> : null}
        {truncated ? <span className="shrink-0 text-amber-600 dark:text-amber-400">arquivo grande — exibindo prévia</span> : null}
        <span className="ml-auto shrink-0 text-slate-400">somente leitura</span>
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <p className="max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">{error}</p>
        </div>
      ) : busy ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">Carregando arquivo…</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <pre className="m-0 flex text-[12px] leading-5 font-mono">
            <span className="sticky left-0 shrink-0 select-none border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-right text-slate-400" style={{ width: gutterWidth }}>
              {lines.map((_, index) => <span key={index} className="block">{index + 1}</span>)}
            </span>
            <code className="block px-3 py-2 whitespace-pre text-slate-800 dark:text-slate-200">
              {lines.map((line, index) => <span key={index} className="block">{tokenize(line)}</span>)}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
};
