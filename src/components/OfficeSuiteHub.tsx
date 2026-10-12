import React from 'react';
import {
  IconBook2,
  IconScan,
  IconHeadphones,
  IconPhoto,
  IconArrowUpRight,
} from '@tabler/icons-react';
import type { MicrosoftUserProfile, TabType } from '../types';

export interface OfficeSuiteHubProps {
  onSelectTool?: (tool: TabType) => void;
  onOpenTool?: (tool: TabType) => void;
  msUser?: MicrosoftUserProfile | null;
  setMsUser?: React.Dispatch<React.SetStateAction<MicrosoftUserProfile | null>>;
  onLoginMs?: () => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
}

const MODULES: Array<{
  id: TabType;
  title: string;
  detail: string;
  eyebrow: string;
  icon: React.ComponentType<{ className?: string }>;
  glyph: string;
  tone: string;
  size: string;
}> = [
  {
    id: 'reader',
    title: 'Leitor universal',
    detail: 'Leia PDF, DOCX, XLSX, PPTX, EPUB, Markdown, texto, imagens e arquivos ZIP sem editar o original.',
    eyebrow: 'DOCUMENTOS',
    icon: IconBook2,
    glyph: 'fi-rr-book-open',
    tone: 'from-sky-500/15 to-blue-500/5 border-sky-500/20',
    size: 'md:col-span-2',
  },
  {
    id: 'player',
    title: 'Orbit Player',
    detail: 'Playlist, legendas, faixas, retomada e controles inspirados em reprodutores completos. Os codecs disponíveis dependem do dispositivo.',
    eyebrow: 'MÍDIA',
    icon: IconHeadphones,
    glyph: 'fi-rr-play-alt',
    tone: 'from-violet-500/15 to-fuchsia-500/5 border-violet-500/20',
    size: '',
  },
  {
    id: 'image',
    title: 'Estúdio de imagens',
    detail: 'Geração e edição por instrução, além de aprimoramento local. O estúdio informa quando um modelo remoto precisa ser configurado.',
    eyebrow: 'CRIATIVIDADE',
    icon: IconPhoto,
    glyph: 'fi-rr-gallery',
    tone: 'from-amber-500/15 to-orange-500/5 border-amber-500/20',
    size: '',
  },
  {
    id: 'extract',
    title: 'PDF & OCR',
    detail: 'Leia páginas, extraia texto de PDFs e imagens e encaminhe conteúdo ao Nexus AI quando necessário.',
    eyebrow: 'CAPTURA',
    icon: IconScan,
    glyph: 'fi-rr-scan',
    tone: 'from-emerald-500/15 to-teal-500/5 border-emerald-500/20',
    size: '',
  },
];

export const OfficeSuiteHub: React.FC<OfficeSuiteHubProps> = ({ onOpenTool, onSelectTool }) => {
  const open = (tool: TabType) => (onOpenTool || onSelectTool)?.(tool);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#101827] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
            <i className="fi fi-rr-apps text-2xl" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Orbit · Espaços de trabalho</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Ferramentas que fazem sentido juntas.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">Leitura e captura são experiências seguras; o reprodutor é uma ferramenta de mídia; a criação de imagens funciona como um estúdio independente. O Nexus AI conecta os fluxos quando você decide.</p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {MODULES.map((module) => {
          const Icon = module.icon;
          return (
            <button key={module.id} type="button" onClick={() => open(module.id)} className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${module.tone} ${module.size}`}>
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/40 bg-white/70 text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100">
                  <i className={`fi ${module.glyph} text-xl`} aria-hidden="true" />
                  <Icon className="hidden h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[9px] font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">{module.eyebrow}</span>
                  <span className="mt-1 block text-base font-semibold text-slate-950 dark:text-white">{module.title}</span>
                  <span className="mt-2 block max-w-xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">{module.detail}</span>
                </span>
                <IconArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-slate-400">
        <span>Orbit · quatro espaços especializados, conectados por decisão do usuário.</span>
        <a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer" className="hover:text-blue-500">Uicons by Flaticon</a>
      </footer>
    </div>
  );
};
