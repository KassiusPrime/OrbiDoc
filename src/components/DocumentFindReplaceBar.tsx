import React, { useEffect, useRef, useState } from 'react';
import { IconReplace as Replace, IconSearch as Search, IconX as X } from '@tabler/icons-react';

const editorRoot = () => document.querySelector<HTMLElement>('.orbidoc-rich-editor[contenteditable="true"]');

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

const notifyInput = (root: HTMLElement) => root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));

type Props = {
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  /** Dentro do drawer "Avançado" o painel fica sempre visível, em layout vertical, e o host cuida de Ctrl+H/Esc. */
  embedded?: boolean;
};

export const DocumentFindReplaceBar: React.FC<Props> = ({ showNotification = () => {}, embedded = false }) => {
  const [open, setOpen] = useState(embedded);
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [count, setCount] = useState(0);
  const cursorRef = useRef(0);

  useEffect(() => {
    if (embedded) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') { event.preventDefault(); setOpen(true); }
      if (event.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, embedded]);

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
    range.setStart(match.node, match.start); range.setEnd(match.node, match.end);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    match.node.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const replaceCurrent = () => {
    const { root, matches } = collect();
    if (!root || !matches.length) return;
    const index = Math.max(0, (cursorRef.current - 1 + matches.length) % matches.length);
    const match = matches[index];
    match.node.replaceData(match.start, match.end - match.start, replace);
    notifyInput(root);
    cursorRef.current = index;
    window.queueMicrotask(findNext);
  };

  const replaceAll = () => {
    const root = editorRoot();
    if (!root || !find) return;
    const target = caseSensitive ? find : find.toLocaleLowerCase('pt-BR');
    let replaced = 0;
    for (const node of textNodes(root)) {
      const original = node.nodeValue || '';
      const haystack = caseSensitive ? original : original.toLocaleLowerCase('pt-BR');
      let position = 0;
      let output = '';
      let from = 0;
      while (position <= haystack.length - target.length) {
        const index = haystack.indexOf(target, position);
        if (index < 0) break;
        output += original.slice(from, index) + replace;
        from = index + find.length;
        position = from;
        replaced += 1;
      }
      if (replaced && from > 0) node.nodeValue = output + original.slice(from);
    }
    if (replaced) notifyInput(root);
    setCount(matchesInRoot(root, find, caseSensitive).length);
    cursorRef.current = 0;
    showNotification(`${replaced} ocorrência(s) substituída(s).`, 'success');
  };

  if (!open) return <button onClick={() => setOpen(true)} className="mb-2 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-black inline-flex items-center gap-2 shadow-sm"><Replace className="w-4 h-4 text-blue-600" /> Localizar e substituir <span className="text-slate-400 font-medium">Ctrl+H</span></button>;

  const findField = <div className="relative flex-1 min-w-[180px]"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><input autoFocus={!embedded} data-orbidoc-find-input="true" value={find} onChange={(event) => { setFind(event.target.value); cursorRef.current = 0; setCount(0); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); findNext(); } }} placeholder="Localizar…" aria-label="Localizar" className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-xs outline-none" /></div>;
  const replaceField = <input value={replace} onChange={(event) => setReplace(event.target.value)} placeholder="Substituir por…" aria-label="Substituir por" className={`${embedded ? 'w-full' : 'flex-1 min-w-[180px]'} h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-xs outline-none`} />;
  const caseToggle = <label className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center gap-2 text-[10px] font-bold whitespace-nowrap"><input type="checkbox" checked={caseSensitive} onChange={(event) => { setCaseSensitive(event.target.checked); cursorRef.current = 0; setCount(0); }} /> Diferenciar maiúsculas</label>;
  const nextButton = <button onClick={findNext} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black whitespace-nowrap">Próxima{count ? ` · ${count}` : ''}</button>;
  const replaceButton = <button onClick={replaceCurrent} className="h-10 px-3 rounded-xl border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-black whitespace-nowrap">Substituir</button>;
  const replaceAllButton = <button onClick={replaceAll} className="h-10 px-3 rounded-xl bg-blue-600 text-white text-[10px] font-black whitespace-nowrap">Substituir tudo</button>;

  if (embedded) {
    return <section aria-label="Localizar e substituir" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
      <div className="flex items-center gap-2"><Replace className="w-4 h-4 text-blue-600" /><span className="text-xs font-black">Localizar e substituir</span><span className="ml-auto text-[10px] text-slate-400 font-medium">Ctrl+H</span></div>
      {findField}
      {replaceField}
      <div className="flex flex-wrap items-center gap-2">{caseToggle}{nextButton}</div>
      <div className="grid grid-cols-2 gap-2">{replaceButton}{replaceAllButton}</div>
    </section>;
  }

  return <div className="mb-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-sm flex flex-col lg:flex-row lg:items-center gap-2">
    {findField}
    {replaceField}
    {caseToggle}
    {nextButton}
    {replaceButton}
    {replaceAllButton}
    <button onClick={() => setOpen(false)} className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar localizar e substituir"><X className="w-4 h-4 mx-auto" /></button>
  </div>;
};
