import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { IconHistory as History, IconPlus as Plus, IconResize as Resize, IconScan as Scan, IconX as X } from '@tabler/icons-react';

export type OrbitSpeedDialAction = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  onSelect: () => void;
  primary?: boolean;
};

export type OrbitSpeedDialProps = {
  actions: OrbitSpeedDialAction[];
  hidden?: boolean;
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
  ariaLabel?: string;
  onOpenChange?: (open: boolean) => void;
};

const OPEN_STAGGER_MS = 40;
const CLOSE_MS = 160;
const OPEN_MS = 200;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

export const OrbitSpeedDial: React.FC<OrbitSpeedDialProps> = ({
  actions,
  hidden = false,
  position = 'bottom-right',
  className = '',
  ariaLabel = 'Ações rápidas',
  onOpenChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const reducedMotion = usePrefersReducedMotion();

  const setOpenSafe = useCallback((next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);

  const close = useCallback(() => {
    setOpenSafe(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }, [setOpenSafe]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, close]);

  useEffect(() => {
    if (hidden && open) close();
  }, [hidden, open, close]);

  if (hidden || actions.length === 0) return null;

  const side = position === 'bottom-right' ? 'right-4 sm:right-5' : 'left-4 sm:left-5';
  const alignItems = position === 'bottom-right' ? 'items-end' : 'items-start';
  const labelSide = position === 'bottom-right' ? 'right-full mr-3 origin-right' : 'left-full ml-3 origin-left';

  return (
    <div ref={rootRef} className={`pointer-events-none fixed bottom-5 z-40 flex flex-col ${alignItems} gap-2 ${side} ${className}`}>
      <button
        type="button"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        className={`pointer-events-auto fixed inset-0 z-[-1] bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={close}
      />
      <ul id={menuId} role="menu" aria-orientation="vertical" className={`flex flex-col-reverse gap-2 ${alignItems}`}>
        {actions.map((action, index) => (
          <li key={action.id} role="none" className="pointer-events-auto">
            <button
              type="button"
              role="menuitem"
              aria-label={action.description ? `${action.label}: ${action.description}` : action.label}
              onClick={() => { action.onSelect(); close(); }}
              className="group flex items-center gap-0"
              style={{
                transition: reducedMotion ? 'opacity 120ms ease' : `opacity ${OPEN_MS}ms cubic-bezier(0.2,0.9,0.3,1), transform ${OPEN_MS}ms cubic-bezier(0.2,0.9,0.3,1)`,
                transitionDelay: open && !reducedMotion ? `${index * OPEN_STAGGER_MS}ms` : '0ms',
                opacity: open ? 1 : 0,
                transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.85)',
                pointerEvents: open ? 'auto' : 'none',
              }}
            >
              <span className={`absolute ${labelSide} whitespace-nowrap rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-100 shadow-lg transition-opacity ${open ? 'sm:opacity-100' : 'opacity-0'} group-hover:opacity-100 group-focus-visible:opacity-100`}>
                {action.label}
              </span>
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-md transition-transform active:scale-95 ${action.primary ? 'border-blue-500/40 bg-blue-600 text-white hover:bg-blue-500' : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'}`}>
                {action.icon}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        ref={buttonRef}
        type="button"
        className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-900/30 transition-transform hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 active:scale-95"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpenSafe(!open)}
        style={{ transition: reducedMotion ? 'background-color 150ms ease' : `background-color 150ms ease, transform ${CLOSE_MS}ms cubic-bezier(0.2,0.9,0.3,1)` }}
      >
        <span className="inline-flex transition-transform duration-200" style={{ transform: open && !reducedMotion ? 'rotate(45deg)' : 'rotate(0deg)' }} aria-hidden>
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </span>
      </button>
    </div>
  );
};

export function useOrbitWorkspaceDialActions(handlers: { onResize?: () => void; onVersions?: () => void; onScan?: () => void }): OrbitSpeedDialAction[] {
  const list: OrbitSpeedDialAction[] = [];
  if (handlers.onScan) list.push({ id: 'scan', label: 'Scan & Reader', description: 'OCR e leitura de documentos', icon: <Scan className="h-5 w-5" />, onSelect: handlers.onScan, primary: true });
  if (handlers.onVersions) list.push({ id: 'versions', label: 'Versões', icon: <History className="h-5 w-5" />, onSelect: handlers.onVersions });
  if (handlers.onResize) list.push({ id: 'resize', label: 'Redimensionar', icon: <Resize className="h-5 w-5" />, onSelect: handlers.onResize });
  return list;
}

export default OrbitSpeedDial;
