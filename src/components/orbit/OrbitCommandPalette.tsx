import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconApps,
  IconFileCheck,
  IconFileSpreadsheet,
  IconFileText,
  IconFolder,
  IconHome,
  IconPalette,
  IconPresentation,
  IconRobot,
  IconSearch,
  IconSettings,
  IconX,
} from '@tabler/icons-react';

type PaletteMode = 'commands' | 'files';
type Command = {
  id: string;
  title: string;
  keywords: string;
  section: 'Navegar' | 'Criar' | 'Conta';
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
};

function clickButton(text: string) {
  const normalized = text.trim().toLocaleLowerCase('pt-BR');
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    .find((candidate) => candidate.textContent?.trim().toLocaleLowerCase('pt-BR') === normalized
      || candidate.textContent?.trim().toLocaleLowerCase('pt-BR').includes(normalized));
  button?.click();
  return Boolean(button);
}

function clickAria(label: string) {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  button?.click();
  return Boolean(button);
}

function createInOrbiDoc(moduleName: string) {
  const opened = clickAria('Criar novo');
  if (!opened) clickButton('Criar no OrbiDoc');
  window.setTimeout(() => clickButton(moduleName), 80);
}

export const OrbitCommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>('commands');
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commands = useMemo<Command[]>(() => [
    { id: 'home', title: 'Ir para Orbispace', keywords: 'inicio home workspace orbispace', section: 'Navegar', icon: Home, run: () => clickButton('Orbispace') },
    { id: 'files', title: 'Abrir Meus arquivos', keywords: 'arquivos satellite files projetos', section: 'Navegar', icon: Folder, run: () => clickButton('Meus arquivos') },
    { id: 'apps', title: 'Abrir OrbiDoc', keywords: 'apps suite ferramentas office', section: 'Navegar', icon: Apps, run: () => clickButton('OrbiDoc') },
    { id: 'nexus', title: 'Abrir Nexus AI', keywords: 'assistente chat ai pesquisar', section: 'Navegar', icon: Robot, run: () => clickButton('Nexus AI') },
    { id: 'nova', title: 'Criar no Orbit Nova', keywords: 'documento docx word nova texto', section: 'Criar', icon: FileText, run: () => createInOrbiDoc('Orbit Nova') },
    { id: 'gravity', title: 'Criar no Orbit Gravity', keywords: 'planilha xlsx excel gravity dados', section: 'Criar', icon: FileSpreadsheet, run: () => createInOrbiDoc('Orbit Gravity') },
    { id: 'aurora', title: 'Criar no Orbit Aurora', keywords: 'apresentacao pptx slides aurora', section: 'Criar', icon: Presentation, run: () => createInOrbiDoc('Orbit Aurora') },
    { id: 'comet', title: 'Criar no Orbit Comet', keywords: 'design canvas comet imagem', section: 'Criar', icon: Palette, run: () => createInOrbiDoc('Orbit Comet') },
    { id: 'nebula', title: 'Abrir Orbit Nebula', keywords: 'pdf ocr nebula extrair', section: 'Criar', icon: FileCheck, run: () => createInOrbiDoc('Orbit Nebula') },
    { id: 'account', title: 'Conta Orbit e conexões', keywords: 'conta google microsoft github seguranca conexoes', section: 'Conta', icon: Settings, run: () => clickAria('Conta Orbit e conexões externas') },
  ], []);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    const base = mode === 'files' ? commands.filter((command) => command.id === 'files' || command.id === 'nova' || command.id === 'gravity' || command.id === 'aurora' || command.id === 'comet' || command.id === 'nebula') : commands;
    if (!needle) return base;
    return base.filter((command) => `${command.title} ${command.keywords}`.toLocaleLowerCase('pt-BR').includes(needle));
  }, [commands, mode, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setMode('commands');
        setOpen(true);
        setQuery('');
      } else if (modifier && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setMode('files');
        setOpen(true);
        setQuery('');
      } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => { document.body.style.overflow = previous; };
  }, [open, mode]);

  useEffect(() => {
    if (activeIndex >= results.length) setActiveIndex(Math.max(0, results.length - 1));
  }, [activeIndex, results.length]);

  if (!open) return null;

  const execute = (command: Command) => {
    setOpen(false);
    window.setTimeout(command.run, 20);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-[max(12px,env(safe-area-inset-top))_12px_12px] sm:pt-[12vh]" role="presentation">
      <button type="button" aria-label="Fechar paleta de comandos" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
      <section role="dialog" aria-modal="true" aria-label={mode === 'files' ? 'Busca rápida de arquivos' : 'Paleta de comandos do Orbit'} className="relative w-full max-w-2xl overflow-hidden rounded-[16px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111318] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(results.length - 1, index + 1)); }
              if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
              if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); execute(results[activeIndex]); }
            }}
            placeholder={mode === 'files' ? 'Buscar arquivo ou tipo para criar…' : 'Digite um comando, módulo ou destino…'}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <span className="hidden sm:inline-flex rounded-[8px] border border-slate-200 dark:border-slate-700 px-1.5 py-1 text-[9px] font-bold text-slate-400">ESC</span>
          <button type="button" onClick={() => setOpen(false)} className="h-9 w-9 rounded-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[min(62dvh,520px)] overflow-y-auto p-1.5">
          {results.length ? results.map((command, index) => {
            const Icon = command.icon;
            return (
              <button
                type="button"
                key={command.id}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => execute(command)}
                className={`w-full min-h-11 rounded-[10px] px-2.5 py-2 flex items-center gap-3 text-left ${index === activeIndex ? 'bg-[#EEF3FF] dark:bg-[#111D4A]' : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'}`}
              >
                <span className="h-8 w-8 shrink-0 rounded-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{command.title}</span><span className="block mt-0.5 text-[9px] text-slate-400">{command.section}</span></span>
                <span className="hidden sm:block text-[9px] font-semibold text-slate-400">Enter</span>
              </button>
            );
          }) : (
            <div className="px-4 py-10 text-center"><div className="text-sm font-bold">Nenhum comando encontrado</div><div className="mt-1 text-xs text-slate-500">Tente outro nome de módulo, arquivo ou ação.</div></div>
          )}
        </div>

        <footer className="border-t border-slate-100 dark:border-slate-800 px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-400">
          <span>↑↓ navegar</span><span>Enter abrir</span><span>Ctrl/Cmd+K comandos</span><span>Ctrl/Cmd+P arquivos</span>
        </footer>
      </section>
    </div>
  );
};
