import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconListSearch as Outline } from '@tabler/icons-react';

type Heading = { id: string; level: number; text: string };

const EDITOR_SELECTOR = '.orbidoc-rich-editor';

const collectHeadings = (): Heading[] => {
  const root = document.querySelector<HTMLElement>(EDITOR_SELECTOR);
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>('h1, h2, h3, h4')].map((node, index) => {
    if (!node.dataset.orbitOutlineId) node.dataset.orbitOutlineId = `orbit-outline-${index}`;
    return {
      id: node.dataset.orbitOutlineId,
      level: Number(node.tagName.slice(1)),
      text: node.textContent?.trim() || 'Sem título',
    };
  });
};

/**
 * Painel de estrutura do documento (equivalente ao "Esboço" do Google Docs e
 * ao "Painel de Navegação" do Word). Lê os títulos direto do editor e navega
 * até eles, sem exigir mudanças no modelo de dados.
 */
export const DocumentOutlinePane: React.FC = () => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [filter, setFilter] = useState('');

  const refresh = useCallback(() => setHeadings(collectHeadings()), []);

  useEffect(() => {
    refresh();
    const root = document.querySelector<HTMLElement>(EDITOR_SELECTOR);
    if (!root) return;
    let frame = 0;
    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(refresh);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [refresh]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? headings.filter((item) => item.text.toLowerCase().includes(needle)) : headings;
  }, [filter, headings]);

  const goTo = (id: string) => {
    const target = document.querySelector<HTMLElement>(`[data-orbit-outline-id="${id}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  return (
    <>
      <div className="h-10 shrink-0 px-3 flex items-center gap-2 border-b border-[var(--workspace-border)]">
        <Outline className="w-4 h-4 text-[var(--brand-primary)]" />
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--workspace-muted)]">Estrutura</span>
        <span className="ml-auto text-[10px] text-[var(--workspace-muted)]">{headings.length}</span>
      </div>
      <div className="px-2 pt-2 shrink-0">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filtrar títulos…"
          aria-label="Filtrar títulos do documento"
          className="w-full h-8 px-2.5 rounded-lg bg-[var(--workspace-surface-muted)] text-[11px] outline-none"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        {visible.length ? visible.map((heading) => (
          <button key={heading.id} type="button" data-level={heading.level} onClick={() => goTo(heading.id)} className="orbit-outline-item truncate">
            {heading.text}
          </button>
        )) : (
          <p className="px-2 py-6 text-[11px] leading-relaxed text-center text-[var(--workspace-muted)]">
            Use Título 1, 2 ou 3 no documento para montar a estrutura navegável.
          </p>
        )}
      </div>
    </>
  );
};
