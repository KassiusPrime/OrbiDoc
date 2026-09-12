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

/** Campo base dos controles do formulário (mesma altura em qualquer largura). */
const FIELD = 'h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent';

type Props = {
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  /** Renderiza direto o formulário completo (usado pelo drawer "Avançado"). */
  alwaysOpen?: boolean;
  /** Remove card e margens para uso dentro de um painel lateral. */
  embedded?: boolean;
  /** Busca controlada pela barra de status do editor. */
  query?: string;
  onQueryChange?: (value: string) => void;
  /** Quando informado, fechar o formulário fecha o painel que o contém. */
  onRequestClose?: () => void;
};

export const DocumentFindReplaceBar: React.FC<Props> = ({
  showNotification = () => {},
  alwaysOpen = false,
  embedded = false,
  query,
  onQueryChange,
  onRequestClose,
}) => {
  const [open, setOpen] = useState(alwaysOpen);
  const [localFind, setLocalFind] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [count, setCount] = useState(0);
  const cursorRef = useRef(0);
  const find = query ?? localFind;
  const setFind = (value: string) => { if (onQueryChange) onQueryChange(value); else setLocalFind(value); };

  const close = () => { if (onRequestClose) onRequestClose(); else setOpen(false); };
  const expanded = alwaysOpen || open;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') { event.preventDefault(); setOpen(true); }
      if (event.key === 'Escape' && expanded) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, onRequestClose]);

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

  if (!expanded) {
    return (
      <button onClick={() => setOpen(true)} className="mb-2 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-black inline-flex items-center gap-2 shadow-sm">
        <Replace className="w-4 h-4 text-blue-600" /> Localizar e substituir <span className="text-slate-400 font-medium">Ctrl+H</span>
      </button>
    );
  }

  const wrapper = embedded
    ? 'flex flex-col gap-1.5'
    : 'mb-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-sm flex flex-col lg:flex-row lg:items-center gap-2';

  return (
    <div className={wrapper}>
      <div className={`relative ${embedded ? '' : 'flex-1 min-w-[180px]'}`}>
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          autoFocus
          value={find}
          onChange={(event) => { setFind(event.target.value); cursorRef.current = 0; setCount(0); }}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); findNext(); } }}
          placeholder="Localizar…"
          aria-label="Localizar no documento"
          className={`w-full rounded-lg bg-slate-100 dark:bg-slate-950 text-xs outline-none ${embedded ? 'h-9 pl-8 pr-2.5' : 'h-10 pl-9 pr-3 rounded-xl'}`}
        />
      </div>
      <input
        value={replace}
        onChange={(event) => setReplace(event.target.value)}
        placeholder="Substituir por…"
        aria-label="Substituir por"
        className={`flex-1 rounded-lg bg-slate-100 dark:bg-slate-950 text-xs outline-none ${embedded ? 'h-9 px-2.5' : 'min-w-[180px] h-10 px-3 rounded-xl'}`}
      />
      <label className={`${FIELD} px-2.5 inline-flex items-center gap-1.5 text-[10px] font-bold ${embedded ? '' : 'shrink-0 whitespace-nowrap'}`}>
        <input type="checkbox" checked={caseSensitive} onChange={(event) => { setCaseSensitive(event.target.checked); cursorRef.current = 0; setCount(0); }} />
        Diferenciar maiúsculas
      </label>
      <div className={embedded ? 'grid grid-cols-2 gap-1.5' : 'flex items-center gap-1.5'}>
        <button onClick={findNext} className={`${FIELD} px-2.5 text-[10px] font-black`}>Próxima{count ? ` · ${count}` : ''}</button>
        <button onClick={replaceCurrent} className={`${FIELD} px-2.5 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-black`}>Substituir</button>
        <button onClick={replaceAll} className={`${embedded ? 'col-span-2 ' : ''}h-9 px-2.5 rounded-lg bg-blue-600 text-white text-[10px] font-black shrink-0`}>Substituir tudo</button>
      </div>
      {!embedded ? (
        <button onClick={close} className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0" aria-label="Fechar localizar e substituir">
          <X className="w-4 h-4 mx-auto" />
        </button>
      ) : null}
    </div>
  );
};
