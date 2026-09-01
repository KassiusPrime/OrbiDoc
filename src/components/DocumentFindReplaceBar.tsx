import React, { useEffect, useRef, useState } from 'react';
import { IconReplace as Replace, IconSearch as Search, IconX as X } from '@tabler/icons-react';
import {
  LEXICAL_FIND_REPLACE_DONE_EVENT,
  LEXICAL_FIND_REPLACE_EVENT,
  type LexicalFindReplaceDetail,
} from './LexicalFindReplacePlugin';

const editorRoot = () => document.querySelector<HTMLElement>('.orbidoc-lexical-editor[contenteditable="true"], .orbidoc-rich-editor[contenteditable="true"]');

const textNodes = (root: HTMLElement) => {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style')) return NodeFilter.FILTER_REJECT;
      return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let node = walker.nextNode();
  while (node) { nodes.push(node as Text); node = walker.nextNode(); }
  return nodes;
};

const matchesInRoot = (root: HTMLElement, needle: string, caseSensitive: boolean) => {
  if (!needle) return [] as Array<{ node: Text; start: number; end: number }>;
  const target = caseSensitive ? needle : needle.toLocaleLowerCase('pt-BR');
  const matches: Array<{ node: Text; start: number; end: number }> = [];
  for (const node of textNodes(root)) {
    const source = caseSensitive ? (node.nodeValue || '') : (node.nodeValue || '').toLocaleLowerCase('pt-BR');
    let from = 0;
    while (from <= source.length - target.length) {
      const index = source.indexOf(target, from);
      if (index < 0) break;
      matches.push({ node, start: index, end: index + needle.length });
      from = index + Math.max(1, needle.length);
    }
  }
  return matches;
};

const dispatchLexicalReplace = (detail: LexicalFindReplaceDetail) => {
  window.dispatchEvent(new CustomEvent<LexicalFindReplaceDetail>(LEXICAL_FIND_REPLACE_EVENT, { detail }));
};

export const DocumentFindReplaceBar: React.FC<{ showNotification?: (message: string, type?: 'success' | 'error') => void }> = ({ showNotification = () => {} }) => {
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [count, setCount] = useState(0);
  const cursorRef = useRef(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') { event.preventDefault(); setOpen(true); }
      if (event.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const onDone = (event: Event) => {
      const replaced = Number((event as CustomEvent<{ replaced: number }>).detail?.replaced || 0);
      window.queueMicrotask(() => {
        const root = editorRoot();
        setCount(root && find ? matchesInRoot(root, find, caseSensitive).length : 0);
      });
      if (replaced > 0) showNotification(`${replaced} ocorrência(s) substituída(s).`, 'success');
    };
    window.addEventListener(LEXICAL_FIND_REPLACE_DONE_EVENT, onDone as EventListener);
    return () => window.removeEventListener(LEXICAL_FIND_REPLACE_DONE_EVENT, onDone as EventListener);
  }, [find, caseSensitive, showNotification]);

  const collect = () => {
    const root = editorRoot();
    if (!root || !find) { setCount(0); return { root, matches: [] as ReturnType<typeof matchesInRoot> }; }
    const matches = matchesInRoot(root, find, caseSensitive);
    setCount(matches.length);
    return { root, matches };
  };

  const findNext = () => {
    const { root, matches } = collect();
    if (!root || !matches.length) { showNotification(find ? 'Nenhuma ocorrência encontrada.' : 'Digite o texto que deseja localizar.', 'error'); return; }
    const index = cursorRef.current % matches.length;
    cursorRef.current = (index + 1) % matches.length;
    const match = matches[index];
    const range = document.createRange();
    range.setStart(match.node, match.start);
    range.setEnd(match.node, match.end);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    match.node.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const replaceCurrent = () => {
    const { matches } = collect();
    if (!matches.length) {
      showNotification(find ? 'Nenhuma ocorrência encontrada.' : 'Digite o texto que deseja localizar.', 'error');
      return;
    }
    const index = Math.max(0, (cursorRef.current - 1 + matches.length) % matches.length);
    dispatchLexicalReplace({ action: 'replace-current', find, replace, caseSensitive, occurrenceIndex: index });
    cursorRef.current = index;
  };

  const replaceAll = () => {
    const { matches } = collect();
    if (!matches.length) {
      showNotification(find ? 'Nenhuma ocorrência encontrada.' : 'Digite o texto que deseja localizar.', 'error');
      return;
    }
    dispatchLexicalReplace({ action: 'replace-all', find, replace, caseSensitive });
    cursorRef.current = 0;
  };

  if (!open) return <button onClick={() => setOpen(true)} className="mb-2 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-black inline-flex items-center gap-2 shadow-sm"><Replace className="w-4 h-4 text-blue-600" /> Localizar e substituir <span className="text-slate-400 font-medium">Ctrl+H</span></button>;

  return <div className="mb-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-sm flex flex-col lg:flex-row lg:items-center gap-2">
    <div className="relative flex-1 min-w-[180px]"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><input autoFocus value={find} onChange={(event) => { setFind(event.target.value); cursorRef.current = 0; setCount(0); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); findNext(); } }} placeholder="Localizar…" className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-xs outline-none" /></div>
    <input value={replace} onChange={(event) => setReplace(event.target.value)} placeholder="Substituir por…" className="flex-1 min-w-[180px] h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-xs outline-none" />
    <label className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center gap-2 text-[10px] font-bold whitespace-nowrap"><input type="checkbox" checked={caseSensitive} onChange={(event) => { setCaseSensitive(event.target.checked); cursorRef.current = 0; setCount(0); }} /> Diferenciar maiúsculas</label>
    <button onClick={findNext} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black">Próxima{count ? ` · ${count}` : ''}</button>
    <button onClick={replaceCurrent} className="h-10 px-3 rounded-xl border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-black">Substituir</button>
    <button onClick={replaceAll} className="h-10 px-3 rounded-xl bg-blue-600 text-white text-[10px] font-black">Substituir tudo</button>
    <button onClick={() => setOpen(false)} className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar localizar e substituir"><X className="w-4 h-4 mx-auto" /></button>
  </div>;
};
