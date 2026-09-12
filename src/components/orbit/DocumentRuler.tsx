import React from 'react';

/** 1 cm em CSS px a 96 dpi — mesma base das larguras A4/Letter do editor. */
const PX_PER_CM = 96 / 2.54;

interface Props {
  /** Largura lógica da folha em px CSS (794 = A4, 816 = Letter). */
  pageWidth: number;
  /** Margem interna da folha em px CSS. */
  marginPx: number;
  /** Zoom aplicado à folha, em % — a régua acompanha. */
  zoom: number;
}

/**
 * Régua horizontal em centímetros, alinhada à folha.
 *
 * Fica logo abaixo da toolbar e usa exatamente a mesma matemática da página
 * (largura lógica + `scale(zoom)` com origem no topo central), então as marcas
 * permanecem alinhadas ao texto em qualquer nível de zoom. As áreas de margem
 * são sombreadas para o usuário enxergar a área útil sem abrir o setup.
 */
export const DocumentRuler: React.FC<Props> = ({ pageWidth, marginPx, zoom }) => {
  const scale = zoom / 100;
  const centimetres = Math.floor(pageWidth / PX_PER_CM);
  const ticks = Array.from({ length: centimetres + 1 }, (_, index) => index);
  const marginLeftPct = (marginPx / pageWidth) * 100;
  const usablePct = 100 - marginLeftPct * 2;

  return (
    <div className="orbit-doc-ruler border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 overflow-hidden" aria-hidden="true">
      <div
        className="orbit-doc-ruler__sheet mx-auto relative h-6"
        style={{ width: pageWidth, maxWidth: '100%', transform: `scale(${scale})`, transformOrigin: 'top center' }}
      >
        {/* Área útil entre margens. */}
        <span
          className="absolute inset-y-0 bg-white dark:bg-slate-800"
          style={{ left: `${marginLeftPct}%`, width: `${usablePct}%` }}
        />

        {/* Marcas de centímetro. */}
        {ticks.map((cm) => (
          <span key={cm} className="absolute top-0 bottom-0" style={{ left: `${(cm / centimetres) * 100}%` }}>
            <span className="block w-px h-full bg-slate-300 dark:bg-slate-600" />
            {cm % 2 === 0 && cm !== 0 && cm !== centimetres ? (
              <span className="absolute top-0.5 left-1 text-[8px] font-medium text-slate-400 select-none">{cm}</span>
            ) : null}
          </span>
        ))}

        {/* Meias marcas. */}
        {ticks.slice(0, -1).map((cm) => (
          <span key={`half-${cm}`} className="absolute top-1/2 h-2 w-px bg-slate-300/70 dark:bg-slate-600/70" style={{ left: `${((cm + 0.5) / centimetres) * 100}%` }} />
        ))}

        {/* Guias de margem. */}
        <span className="absolute inset-y-0 w-px bg-blue-400/70" style={{ left: `${marginLeftPct}%` }} />
        <span className="absolute inset-y-0 w-px bg-blue-400/70" style={{ left: `${100 - marginLeftPct}%` }} />
      </div>
    </div>
  );
};
