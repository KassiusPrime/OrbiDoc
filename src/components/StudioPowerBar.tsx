import React, { useState } from 'react';
import {
  IconDeviceFloppy as Save,
  IconDownload as Download,
  IconKeyboard as Keyboard,
  IconX as X,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { snapshotAllProjects } from '../lib/projectVersions';
import { SavedProject } from '../types';

type StudioKind = 'word' | 'excel' | 'powerpoint' | 'canva';
const SHORTCUTS: Record<StudioKind, Array<[string, string]>> = {
  word: [['Ctrl/Cmd + B', 'Negrito'], ['Ctrl/Cmd + I', 'Itálico'], ['Ctrl/Cmd + Z', 'Desfazer'], ['Ctrl/Cmd + F', 'Pesquisar (navegador/editor)']],
  excel: [['Enter', 'Avançar uma linha'], ['Tab / Shift+Tab', 'Mover entre colunas'], ['Shift + clique', 'Selecionar intervalo'], ['Ctrl/Cmd + V', 'Colar bloco de células']],
  powerpoint: [['Arrastar', 'Mover elemento'], ['Arrastar alça', 'Redimensionar'], ['Shift ao redimensionar', 'Preservar proporção'], ['Apresentar', 'Modo de apresentação']],
  canva: [['Ctrl/Cmd + Z', 'Desfazer'], ['Ctrl/Cmd + Shift + Z', 'Refazer'], ['Ctrl/Cmd + D', 'Duplicar elemento'], ['Setas / Shift+setas', 'Mover 1px / 10px'], ['Delete', 'Excluir elemento']],
};

export const StudioPowerBar: React.FC<{ project: SavedProject; kind: StudioKind; showNotification?: (message: string, type?: 'success' | 'error') => void; layout?: 'bar' | 'stack' }> = ({ project, kind, showNotification = () => {}, layout = 'bar' }) => {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const backup = () => {
    try {
      const payload = JSON.stringify({ format: 'orbidoc-project', version: 1, exportedAt: new Date().toISOString(), project }, null, 2);
      const safe = (project.title || 'projeto').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'projeto';
      saveAs(new Blob([payload], { type: 'application/json;charset=utf-8' }), `${safe}.orbidoc-project.json`);
      showNotification('Backup do projeto exportado.', 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha ao exportar backup.', 'error'); }
  };
  const snapshot = () => {
    const count = snapshotAllProjects(true);
    showNotification(count ? 'Versão local criada. Você pode restaurá-la em Histórico de versões.' : 'Não foi possível criar a versão.', count ? 'success' : 'error');
  };
  return <div className={`orbidoc-studio-powerbar rounded-2xl bg-white dark:bg-[#101827] px-3 py-2 flex flex-wrap items-center gap-2 ${layout === 'stack' ? '' : 'mb-2'}`}><div className={layout === 'stack' ? 'w-full' : 'min-w-0 flex-1'}><div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Studio Pro</div><div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Autosave local · versões · backup portátil · atalhos</div></div><button onClick={snapshot} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2"><Save className="w-4 h-4 text-[#3157F6]" /> Criar versão</button><button onClick={backup} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2"><Download className="w-4 h-4 text-[#3157F6]" /> Backup</button><button onClick={() => setShowShortcuts(true)} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2"><Keyboard className="w-4 h-4" /> Atalhos</button>{showShortcuts && <div className="fixed inset-0 z-[145] bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowShortcuts(false); }}><section role="dialog" aria-modal="true" aria-label="Atalhos do editor" className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] shadow-2xl overflow-hidden"><header className="h-14 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center"><div className="flex-1 text-sm font-black">Atalhos do editor</div><button onClick={() => setShowShortcuts(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4 mx-auto" /></button></header><div className="p-4 space-y-2">{SHORTCUTS[kind].map(([shortcut, action]) => <div key={shortcut} className="flex items-center gap-3"><kbd className="min-w-32 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[9px] font-black text-center">{shortcut}</kbd><span className="text-xs text-slate-600 dark:text-slate-300">{action}</span></div>)}</div></section></div>}</div>;
};
