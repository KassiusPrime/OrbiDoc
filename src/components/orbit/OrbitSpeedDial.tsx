import React, { useEffect, useRef } from 'react';
import { IconHistory, IconPlus, IconScan, IconX, IconResize } from '@tabler/icons-react';

interface OrbitSpeedDialProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  hidden?: boolean;
}

const actions = [
  { label: 'Scan & Reader', ariaLabel: 'Abrir Scan e Reader', icon: IconScan },
  { label: 'Versões', ariaLabel: 'Abrir histórico de versões', icon: IconHistory },
  { label: 'Redimensionar', ariaLabel: 'Abrir redimensionador de imagens', icon: IconResize },
] as const;

function trigger(label: string): void {
  document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.click();
}

export const OrbitSpeedDial: React.FC<OrbitSpeedDialProps> = ({ open, onOpen, onClose, hidden = false }) => {
  const fabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (hidden && open) onClose();
  }, [hidden, open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        requestAnimationFrame(() => fabRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (hidden) return null;

  return (
    <div className="fixed bottom-[78px] right-4 z-[60] lg:bottom-5" aria-label="Ações do Orbit">
      {open ? <button type="button" className="fixed inset-0 z-[-1] cursor-default bg-slate-950/15" aria-label="Fechar ações" onClick={onClose} /> : null}
      <div className={`mb-2 flex flex-col items-end gap-1.5 transition-opacity duration-150 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} role="menu" aria-hidden={!open}>
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              tabIndex={open ? 0 : -1}
              onClick={() => { onClose(); window.setTimeout(() => trigger(action.ariaLabel), 40); }}
              className="group flex min-h-9 items-center gap-2 rounded-full border border-slate-700/60 bg-[#141820] px-2.5 pl-3 text-[10px] font-medium text-slate-300 shadow-sm transition-[transform,opacity,background-color] duration-150 hover:bg-[#1a202b] active:scale-95"
              style={{ transitionDelay: open ? `${index * 40}ms` : '0ms', transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(.85)' }}
            >
              <span>{action.label}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600/10 text-blue-400"><Icon className="h-3.5 w-3.5" /></span>
            </button>
          );
        })}
      </div>
      <button
        ref={fabRef}
        type="button"
        onClick={() => open ? onClose() : onOpen()}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? 'Fechar ações do Orbit' : 'Abrir ações do Orbit'}
        className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-950/25 transition-transform duration-150 hover:bg-blue-500 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400/40 motion-reduce:transition-none"
      >
        {open ? <IconX className="h-5 w-5 transition-transform duration-150 motion-reduce:transition-none" /> : <IconPlus className="h-5 w-5" />}
      </button>
    </div>
  );
};
