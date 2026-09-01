import React, { useEffect, useState } from 'react';
import { IconFileSpreadsheet, IconFileText, IconFileTypePdf, IconX } from '@tabler/icons-react';
import { DocumentEditorLexical } from './DocumentEditorLexical';
import { SpreadsheetEditorFortune } from './SpreadsheetEditorFortune';
import { PdfStudio } from './PdfStudio';
import { xlsxArrayBufferToFortuneSheets } from '../lib/fortuneSpreadsheet';
import { savePdfLocal } from '../services/offlinePersistence';
import type { SavedProject } from '../types';

const PROFESSIONAL_FILE_EVENT = 'orbidoc:open-professional-file';

export type ProfessionalFileOpenDetail = { file: File };

const newProject = (type: SavedProject['type'], title: string, content?: unknown): SavedProject => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    type,
    createdAt: now,
    updatedAt: now,
    previewSnippet: 'Arquivo aberto pelo sistema operacional.',
    tags: ['Abrir com'],
    content,
  };
};

async function docxToHtml(file: File) {
  const imported = await import('mammoth');
  const mammoth = (imported as any).default || imported;
  const result = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      convertImage: mammoth.images.imgElement(async (image: any) => ({
        src: `data:${image.contentType};base64,${await image.read('base64')}`,
      })),
    },
  );
  return result.value || '<p></p>';
}

const extensionOf = (file: File) => file.name.split('.').pop()?.toLowerCase() || '';

export function dispatchProfessionalFile(file: File) {
  window.dispatchEvent(new CustomEvent<ProfessionalFileOpenDetail>(PROFESSIONAL_FILE_EVENT, { detail: { file } }));
}

export function isProfessionalOfficeFile(file: File) {
  const extension = extensionOf(file);
  return ['docx', 'xlsx', 'xls', 'ods', 'csv', 'tsv', 'pdf'].includes(extension)
    || file.type === 'application/pdf'
    || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

export const ProfessionalFileRouterAgent: React.FC = () => {
  const [project, setProject] = useState<SavedProject | null>(null);
  const [kind, setKind] = useState<'word' | 'excel' | 'pdf' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const file = (event as CustomEvent<ProfessionalFileOpenDetail>).detail?.file;
      if (!file) return;
      setError('');
      setNotice(null);
      void (async () => {
        const extension = extensionOf(file);
        const title = file.name.replace(/\.[^/.]+$/, '') || file.name;
        if (extension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const html = await docxToHtml(file);
          setProject(newProject('word', title, html));
          setKind('word');
          return;
        }
        if (['xlsx', 'xls', 'ods', 'csv', 'tsv'].includes(extension)
          || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          const sheets = xlsxArrayBufferToFortuneSheets(await file.arrayBuffer());
          setProject(newProject('excel', title, sheets));
          setKind('excel');
          return;
        }
        if (extension === 'pdf' || file.type === 'application/pdf') {
          const next = newProject('extract', title, { pdfStudio: { fileName: file.name } });
          await savePdfLocal({
            id: next.id,
            title,
            pdfBlob: file,
            annotationsJSON: [],
            updatedAt: next.updatedAt,
            fileName: file.name,
            isSynced: false,
            syncState: 'local',
          });
          setProject(next);
          setKind('pdf');
          return;
        }
        throw new Error('Este formato não possui um editor profissional associado.');
      })().catch((reason) => {
        setKind(null);
        setProject(null);
        setError(reason instanceof Error ? reason.message : 'Falha ao abrir arquivo no editor profissional.');
      });
    };
    window.addEventListener(PROFESSIONAL_FILE_EVENT, handler as EventListener);
    return () => window.removeEventListener(PROFESSIONAL_FILE_EVENT, handler as EventListener);
  }, []);

  const close = () => {
    setKind(null);
    setProject(null);
    setError('');
    setNotice(null);
  };

  if (!kind && !error) return null;

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice((current) => current?.message === message ? null : current), 3200);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-[#F7F9FC] dark:bg-[#080D18] flex flex-col orbidoc-professional-file-router">
      <header className="min-h-12 shrink-0 px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kind === 'word' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40' : kind === 'excel' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'}`}>
          {kind === 'word' ? <IconFileText className="w-4 h-4" /> : kind === 'excel' ? <IconFileSpreadsheet className="w-4 h-4" /> : <IconFileTypePdf className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black truncate">{project?.title || 'Abrir com OrbiDoc'}</div>
          <div className="text-[9px] text-slate-400">Editor profissional · local-first</div>
        </div>
        <button type="button" onClick={close} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar editor profissional"><IconX className="w-4 h-4" /></button>
      </header>
      {notice ? <div role={notice.type === 'error' ? 'alert' : 'status'} className={`shrink-0 px-4 py-2 text-[10px] font-bold ${notice.type === 'error' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>{notice.message}</div> : null}
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {error ? (
          <div className="h-full grid place-items-center p-8"><div className="max-w-lg text-center"><div className="text-sm font-black">Falha ao abrir arquivo</div><div className="mt-2 text-xs text-slate-500">{error}</div><button type="button" onClick={close} className="mt-4 h-9 px-4 rounded-xl bg-[#3157F6] text-white text-[10px] font-black">Fechar</button></div></div>
        ) : project && kind === 'word' ? (
          <DocumentEditorLexical project={project} onProjectChange={setProject} showNotification={showNotification} />
        ) : project && kind === 'excel' ? (
          <SpreadsheetEditorFortune project={project} onProjectChange={setProject} showNotification={showNotification} />
        ) : project && kind === 'pdf' ? (
          <PdfStudio project={project} onProjectChange={setProject} showNotification={showNotification} />
        ) : null}
      </main>
    </div>
  );
};
