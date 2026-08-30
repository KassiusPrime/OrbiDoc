import React, { useMemo, useState } from 'react';
import {
  IconCheck as Check,
  IconClockHour4 as Planned,
  IconEdit as Edit,
  IconEye as Open,
  IconFileSearch as Inspect,
  IconRefresh as Convert,
  IconSearch as Search,
} from '@tabler/icons-react';
import { FILE_CAPABILITY_FAMILIES, allRegisteredExtensions, normalizeExtension, type CapabilityLevel } from '../lib/fileCapabilityRegistry';

const CAPABILITY_LABELS: Record<CapabilityLevel, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  open: { label: 'Abrir', icon: Open },
  edit: { label: 'Editar', icon: Edit },
  convert: { label: 'Converter', icon: Convert },
  inspect: { label: 'Inspecionar', icon: Inspect },
  planned: { label: 'Em expansão', icon: Planned },
};

export const SupportedFormatsWorkspace: React.FC = () => {
  const [query, setQuery] = useState('');
  const extensions = useMemo(() => allRegisteredExtensions(), []);
  const filtered = useMemo(() => {
    const needle = normalizeExtension(query);
    if (!needle) return FILE_CAPABILITY_FAMILIES;
    return FILE_CAPABILITY_FAMILIES.filter((family) => family.label.toLowerCase().includes(needle)
      || family.description.toLowerCase().includes(needle)
      || family.extensions.some((extension) => extension.includes(needle)));
  }, [query]);

  return <div className="max-w-5xl mx-auto space-y-4">
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex-1">
          <div className="text-[9px] uppercase tracking-[0.14em] font-black text-[#3157F6]">Compatibilidade de arquivos</div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Um registro. Um fluxo para abrir.</h2>
          <p className="mt-2 max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400">O OrbiDoc organiza formatos por família e mostra com honestidade o que abre, edita, converte ou ainda está em expansão. Engines locais e serviços conectados usam esta mesma referência.</p>
        </div>
        <div className="text-left lg:text-right"><div className="text-2xl font-black">{extensions.length}</div><div className="text-[9px] uppercase tracking-wider font-black text-slate-400">extensões registradas</div></div>
      </div>
      <label className="mt-5 relative block"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar extensão ou família, por exemplo: docx, heic, zip..." className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 text-xs outline-none focus:border-[#3157F6]" /></label>
    </section>

    <div className="grid gap-3">
      {filtered.map((family) => <section key={family.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="min-w-0 flex-1"><h3 className="text-sm font-black">{family.label}</h3><p className="mt-1 text-[10px] sm:text-xs leading-relaxed text-slate-500 dark:text-slate-400">{family.description}</p></div>
          <div className="flex flex-wrap gap-1.5">{family.capabilities.map((capability) => { const meta = CAPABILITY_LABELS[capability]; const Icon = meta.icon; return <span key={capability} className={`min-h-7 px-2.5 rounded-full inline-flex items-center gap-1.5 text-[8px] font-black ${capability === 'planned' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' : 'bg-[#E8EEFF] dark:bg-[#0D1E5B]/55 text-[#2446D8] dark:text-[#AFC4FF]'}`}><Icon className="w-3 h-3" />{meta.label}</span>; })}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">{family.extensions.map((extension) => <span key={extension} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[8px] font-black uppercase tracking-wide">{extension === '*' ? 'qualquer extensão' : extension}</span>)}</div>
        {family.note && <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#3157F6]" /><span>{family.note}</span></div>}
      </section>)}
      {!filtered.length && <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center text-xs text-slate-400">Nenhuma família corresponde a “{query}”. Arquivos não registrados continuam seguindo o fallback seguro de texto/bytes.</div>}
    </div>
  </div>;
};
