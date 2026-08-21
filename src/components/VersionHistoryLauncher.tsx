import React, { useEffect, useMemo, useState } from 'react';
import {
  IconClockRotateRight as History,
  IconDeviceFloppy as Save,
  IconRefresh as Restore,
  IconTrash as Trash,
  IconX as X,
} from '@tabler/icons-react';
import {
  deleteProjectVersion,
  formatVersionBytes,
  loadProjectVersions,
  restoreProjectVersion,
  snapshotAllProjects,
  type ProjectVersion,
} from '../lib/projectVersions';
import { OrbiDocLogo } from './OrbiDocLogo';

export const VersionHistoryLauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<ProjectVersion[]>(() => loadProjectVersions());
  const [notice, setNotice] = useState('');

  const refresh = () => setVersions(loadProjectVersions());

  useEffect(() => {
    let timer = 0;
    const onProjectsUpdated = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        snapshotAllProjects(false);
        refresh();
      }, 900);
    };
    const onVersionsUpdated = () => refresh();
    window.addEventListener('orbidoc:projects-updated', onProjectsUpdated);
    window.addEventListener('orbidoc:versions-updated', onVersionsUpdated);
    const initial = window.setTimeout(() => { snapshotAllProjects(false); refresh(); }, 1400);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(initial);
      window.removeEventListener('orbidoc:projects-updated', onProjectsUpdated);
      window.removeEventListener('orbidoc:versions-updated', onVersionsUpdated);
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const groups = useMemo(() => {
    const map = new Map<string, ProjectVersion[]>();
    versions.forEach((version) => {
      const list = map.get(version.projectId) || [];
      list.push(version);
      map.set(version.projectId, list);
    });
    return Array.from(map.values()).sort((a, b) => new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime());
  }, [versions]);

  const manualSnapshot = () => {
    const count = snapshotAllProjects(true);
    refresh();
    setNotice(count ? `${count} snapshot(s) criado(s).` : 'Não há projetos locais para versionar.');
    window.setTimeout(() => setNotice(''), 2800);
  };

  const restore = (version: ProjectVersion) => {
    if (!version.restorable) {
      setNotice('Essa versão ultrapassou o limite de snapshot restaurável e foi salva apenas como marco.');
      return;
    }
    if (!window.confirm(`Restaurar “${version.projectTitle}” para a versão de ${new Date(version.createdAt).toLocaleString('pt-BR')}?`)) return;
    try {
      snapshotAllProjects(true);
      restoreProjectVersion(version.id);
      setNotice('Versão restaurada. O OrbiDoc será recarregado.');
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao restaurar a versão.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[71] right-[72px] lg:right-[168px] bottom-[84px] lg:bottom-5 h-12 lg:h-11 w-12 lg:w-auto lg:px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] text-slate-700 dark:text-slate-100 shadow-xl inline-flex items-center justify-center gap-2 text-[10px] font-black hover:border-[#3157F6]/40"
        aria-label="Abrir histórico de versões"
        title="Versões · Ctrl+Shift+H"
      >
        <History className="w-5 h-5 text-[#3157F6] dark:text-[#7AA2FF]" />
        <span className="hidden lg:inline">Versões</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] bg-black/30 backdrop-blur-[2px] flex justify-end" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <aside className="w-full sm:w-[460px] h-full bg-[#F7F9FC] dark:bg-[#080D18] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
            <header className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-3">
              <OrbiDocLogo size="sm" />
              <div className="min-w-0 flex-1"><div className="text-xs font-black">Histórico de versões</div><div className="text-[9px] text-slate-400">Snapshots locais recuperáveis · Ctrl+Shift+H</div></div>
              <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar histórico"><X className="w-4 h-4" /></button>
            </header>

            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#101827]/70">
              <button onClick={manualSnapshot} className="w-full h-10 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black inline-flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Criar snapshot agora</button>
              <p className="mt-2 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">O OrbiDoc cria snapshots automáticos com intervalo mínimo de 2 minutos e mantém até 8 versões por projeto. Projetos muito grandes ficam registrados sem duplicar todo o conteúdo para proteger o armazenamento local.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {!groups.length && <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center"><History className="w-10 h-10 mx-auto text-slate-300" /><div className="mt-3 text-xs font-black text-slate-500">Nenhuma versão ainda</div><div className="mt-1 text-[10px] text-slate-400">Edite ou salve um projeto para o histórico começar.</div></div>}
              {groups.map((group) => (
                <section key={group[0].projectId} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] overflow-hidden">
                  <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-800"><div className="text-[10px] font-black truncate">{group[0].projectTitle}</div><div className="mt-0.5 text-[9px] text-slate-400 uppercase">{group[0].projectType} · {group.length} versão(ões)</div></div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {group.map((version, index) => (
                      <div key={version.id} className="p-3 flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${version.restorable ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <div className="min-w-0 flex-1"><div className="text-[9px] font-black">{index === 0 ? 'Mais recente · ' : ''}{new Date(version.createdAt).toLocaleString('pt-BR')}</div><div className="mt-0.5 text-[8px] text-slate-400">{formatVersionBytes(version.size)} · {version.restorable ? 'restaurável' : 'marco de versão'}</div></div>
                        <button onClick={() => restore(version)} disabled={!version.restorable} className="w-8 h-8 rounded-lg hover:bg-[#EFF4FF] dark:hover:bg-[#0D1E5B]/40 text-[#3157F6] dark:text-[#7AA2FF] disabled:text-slate-300 disabled:hover:bg-transparent" title="Restaurar versão"><Restore className="w-4 h-4 mx-auto" /></button>
                        <button onClick={() => { deleteProjectVersion(version.id); refresh(); }} className="w-8 h-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500" title="Excluir versão"><Trash className="w-4 h-4 mx-auto" /></button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {notice && <div className="m-3 mt-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] px-3 py-2 text-[9px] font-bold">{notice}</div>}
          </aside>
        </div>
      )}
    </>
  );
};
