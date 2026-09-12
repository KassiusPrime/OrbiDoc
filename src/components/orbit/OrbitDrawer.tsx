import React from 'react';
import { IconX as X } from '@tabler/icons-react';
import { OrbitResizablePane, useMediaQuery } from './OrbitResizable';

export type OrbitDrawerTab<T extends string> = { id: T; label: string; icon?: React.ReactElement };

interface Props<T extends string> {
  open: boolean;
  onClose: () => void;
  tabs: Array<OrbitDrawerTab<T>>;
  active: T;
  onActiveChange: (tab: T) => void;
  /** Chave de persistência da largura no desktop. */
  storageKey: string;
  /** Rótulo acessível do painel. */
  label: string;
  defaultSize?: number;
  children: React.ReactNode;
}

/**
 * Drawer lateral de ferramentas avançadas.
 *
 * Contrato de surface (§2.3): tudo que é secundário — estrutura, localizar,
 * painéis pro, versões — vive aqui, sob demanda, nunca numa torre de barras
 * acima do protagonista. No desktop é redimensionável e memoriza a largura;
 * abaixo de 1024px vira um sheet de tela cheia.
 */
export function OrbitDrawer<T extends string>({
  open,
  onClose,
  tabs,
  active,
  onActiveChange,
  storageKey,
  label,
  defaultSize = 380,
  children,
}: Props<T>) {
  const compact = useMediaQuery('(max-width: 1023px)');

  if (!open) return null;

  const body = (
    <>
      <div className="h-10 shrink-0 px-3 flex items-center gap-2 border-b border-[var(--workspace-border)]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--workspace-muted)]">Avançado</span>
        <kbd className="orbit-kbd hidden sm:inline-flex">Ctrl + H</kbd>
        <button type="button" onClick={onClose} className="ml-auto w-7 h-7 rounded-md hover:bg-[var(--workspace-surface-muted)]" aria-label={`Fechar ${label}`}>
          <X className="w-3.5 h-3.5 mx-auto" />
        </button>
      </div>

      <div className="orbit-drawer-tabs" role="tablist" aria-label={label}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            data-active={active === item.id}
            onClick={() => onActiveChange(item.id)}
            className="orbit-drawer-tab"
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="orbit-drawer-body" role="tabpanel">{children}</div>
    </>
  );

  if (compact) {
    return (
      <div
        className="fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-sm flex justify-end"
        onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      >
        <aside role="dialog" aria-modal="false" aria-label={label} className="orbit-drawer w-[min(92vw,28rem)]">{body}</aside>
      </div>
    );
  }

  return (
    <OrbitResizablePane
      storageKey={storageKey}
      handle="start"
      defaultSize={defaultSize}
      min={320}
      max={620}
      label={label}
      className="orbit-drawer"
    >
      {body}
    </OrbitResizablePane>
  );
}
