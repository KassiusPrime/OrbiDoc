import React, { useRef } from 'react';
import {
  IconArchive as Archive,
  IconDownload as Download,
  IconUpload as Upload,
} from '@tabler/icons-react';
import {
  downloadWorkspaceBackup,
  readWorkspaceBackup,
  restoreWorkspaceBackup,
} from '../lib/workspaceBackup';

interface WorkspaceBackupControlsProps {
  onNotification?: (message: string, type?: 'success' | 'error') => void;
}

export const WorkspaceBackupControls: React.FC<WorkspaceBackupControlsProps> = ({ onNotification = () => {} }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const exportBackup = () => {
    try {
      const count = downloadWorkspaceBackup();
      onNotification(`Backup local exportado com ${count} registro(s) do OrbiDoc.`, 'success');
    } catch (error) {
      onNotification(error instanceof Error ? error.message : 'Falha ao exportar o backup.', 'error');
    }
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const backup = await readWorkspaceBackup(file);
      const count = Object.keys(backup.entries).length;
      if (!window.confirm(`Restaurar ${count} registro(s) deste backup? Dados locais com as mesmas chaves serão substituídos.`)) return;
      restoreWorkspaceBackup(backup);
      onNotification('Backup restaurado. O OrbiDoc será recarregado para aplicar os dados.', 'success');
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      onNotification(error instanceof Error ? error.message : 'Falha ao restaurar o backup.', 'error');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Archive className="w-4 h-4 text-slate-600 dark:text-slate-300" /></div>
        <div className="min-w-0 flex-1"><div className="text-[10px] font-black text-slate-800 dark:text-slate-100">Backup do workspace</div><div className="mt-0.5 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">Leva projetos, histórico e preferências locais. Não inclui senhas ou tokens de conta.</div></div>
      </div>
      <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { void importBackup(event.target.files?.[0]); }} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={exportBackup} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"><Download className="w-3.5 h-3.5" /> Exportar backup</button>
        <button type="button" onClick={() => inputRef.current?.click()} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"><Upload className="w-3.5 h-3.5" /> Restaurar</button>
      </div>
    </section>
  );
};
