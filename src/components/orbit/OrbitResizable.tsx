import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Orbit Resizable — primitivos de layout redimensionável, sem dependências externas.
 *
 * Referências de arquitetura estudadas para o comportamento (drag + teclado +
 * duplo clique para restaurar + persistência): bvaughn/react-resizable-panels,
 * VS Code (sash), Windmill-City/resizable-panels e o comportamento de painéis
 * do Google Workspace / Microsoft Office (barras laterais arrastáveis com
 * limites mínimos e colapso).
 */

export type OrbitAxis = 'x' | 'y';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const readStoredSize = (storageKey: string, fallback: number) => {
  try {
    const raw = localStorage.getItem(`orbit_pane_${storageKey}`);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const writeStoredSize = (storageKey: string, size: number) => {
  try { localStorage.setItem(`orbit_pane_${storageKey}`, String(Math.round(size))); } catch { /* storage indisponível */ }
};

/** Observa media queries com suporte a SSR/ambientes sem matchMedia. */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    try { return window.matchMedia?.(query).matches ?? false; } catch { return false; }
  });

  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
};

export interface OrbitResizablePaneProps {
  /** Chave estável usada para lembrar o tamanho escolhido pelo usuário. */
  storageKey: string;
  /** Lado onde a alça de arraste é desenhada. */
  handle: 'start' | 'end';
  axis?: OrbitAxis;
  defaultSize: number;
  min?: number;
  max?: number;
  /** Quando verdadeiro, o painel some sem perder o tamanho memorizado. */
  collapsed?: boolean;
  /** Desliga o redimensionamento (ex.: layout mobile empilhado). */
  disabled?: boolean;
  label: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  onSizeChange?: (size: number) => void;
}

/**
 * Painel lateral/superior redimensionável por ponteiro, toque e teclado.
 * `Setas` movem 16px, `Shift+Setas` 64px, `Home`/`End` vão aos limites e o
 * duplo clique restaura o tamanho padrão.
 */
export const OrbitResizablePane: React.FC<OrbitResizablePaneProps> = ({
  storageKey,
  handle,
  axis = 'x',
  defaultSize,
  min = 160,
  max = 720,
  collapsed = false,
  disabled = false,
  label,
  className = '',
  bodyClassName = '',
  children,
  onSizeChange,
}) => {
  const paneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ origin: number; start: number; limit: number } | null>(null);
  const [size, setSize] = useState(() => clamp(readStoredSize(storageKey, defaultSize), min, max));
  const [dragging, setDragging] = useState(false);

  const commit = useCallback((next: number, persist = true) => {
    const value = clamp(Math.round(next), min, max);
    setSize(value);
    onSizeChange?.(value);
    if (persist) writeStoredSize(storageKey, value);
  }, [max, min, onSizeChange, storageKey]);

  const upperBound = useCallback(() => {
    const parent = paneRef.current?.parentElement;
    if (!parent) return max;
    const available = axis === 'x' ? parent.clientWidth : parent.clientHeight;
    // Garante que o conteúdo principal nunca fique menor que 240px.
    return Math.max(min, Math.min(max, available - 240));
  }, [axis, max, min]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    dragRef.current = {
      origin: axis === 'x' ? event.clientX : event.clientY,
      start: size,
      limit: upperBound(),
    };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const position = axis === 'x' ? event.clientX : event.clientY;
    const delta = (position - drag.origin) * (handle === 'end' ? 1 : -1);
    setSize(clamp(Math.round(drag.start + delta), min, drag.limit));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setDragging(false);
    commit(size);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 64 : 16;
    const grow = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
    const shrink = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
    const forward = handle === 'end' ? 1 : -1;

    if (event.key === grow) { event.preventDefault(); commit(size + step * forward); return; }
    if (event.key === shrink) { event.preventDefault(); commit(size - step * forward); return; }
    if (event.key === 'Home') { event.preventDefault(); commit(min); return; }
    if (event.key === 'End') { event.preventDefault(); commit(upperBound()); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit(defaultSize); }
  };

  const style = useMemo<React.CSSProperties>(() => {
    if (disabled) return {};
    const dimension = axis === 'x' ? 'width' : 'height';
    return { [dimension]: collapsed ? 0 : size, [axis === 'x' ? 'minWidth' : 'minHeight']: 0 } as React.CSSProperties;
  }, [axis, collapsed, disabled, size]);

  if (disabled) return <div className={className}>{children}</div>;

  return (
    <div
      ref={paneRef}
      className={`orbit-pane ${collapsed ? 'is-collapsed' : ''} ${dragging ? 'is-dragging' : ''} ${className}`}
      data-orbit-axis={axis}
      style={style}
    >
      <div className={`orbit-pane__body ${bodyClassName}`}>{children}</div>
      {!collapsed ? (
        <div
          role="separator"
          tabIndex={0}
          aria-label={`Redimensionar ${label}`}
          aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={size}
          className={`orbit-pane__handle orbit-pane__handle--${handle}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => commit(defaultSize)}
          onKeyDown={onKeyDown}
        />
      ) : null}
    </div>
  );
};

export interface OrbitResizeGripProps {
  axis: OrbitAxis;
  label: string;
  onResize: (deltaPx: number, phase: 'move' | 'end') => void;
  onReset?: () => void;
  className?: string;
}

/**
 * Alça de arraste isolada para casos onde o tamanho é controlado externamente
 * (colunas e linhas de planilha, por exemplo).
 */
export const OrbitResizeGrip: React.FC<OrbitResizeGripProps> = ({ axis, label, onResize, onReset, className = '' }) => {
  const originRef = useRef<number | null>(null);

  return (
    <span
      role="separator"
      tabIndex={-1}
      aria-label={label}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      className={`orbit-grip orbit-grip--${axis} ${className}`}
      onDoubleClick={(event) => { event.stopPropagation(); onReset?.(); }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        originRef.current = axis === 'x' ? event.clientX : event.clientY;
      }}
      onPointerMove={(event) => {
        if (originRef.current === null) return;
        const position = axis === 'x' ? event.clientX : event.clientY;
        onResize(position - originRef.current, 'move');
        originRef.current = position;
      }}
      onPointerUp={(event) => {
        if (originRef.current === null) return;
        (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
        originRef.current = null;
        onResize(0, 'end');
      }}
    />
  );
};
