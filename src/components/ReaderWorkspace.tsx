import React, { useMemo, useState } from 'react';
import {
  IconBrandGithub,
  IconFile,
  IconFileText,
  IconFolder,
  IconPhoto,
  IconSearch,
  IconUpload,
} from '@tabler/icons-react';
import { GitHubProjectsWorkspace } from './GitHubProjectsWorkspace';

type LocalItem = { id: string; name: string; type: string; size: number; url: string; text?: string };
const textExtensions = new Set(['txt','md','markdown','json','jsonc','yaml','yml','toml','ini','xml','html','htm','css','js','jsx','ts','tsx','py','java','kt','swift','go','rs','c','cpp','h','cs','sh','sql','graphql','env','gitignore','dockerfile']);
const imageExtensions = new Set(['png','jpg','jpeg','gif','webp','svg','bmp','avif']);
const audioExtensions = new Set(['mp3','wav','ogg','m4a','flac','aac']);
const videoExtensions = new Set(['mp4','webm','mov','mkv']);
const extension = (name: string) => name.toLowerCase().split('.').pop() || '';

export const ReaderWorkspace: React.FC = () => {
  const [items, setItems] = useState<LocalItem[]>([]);
  const [selected, setSelected] = useState<LocalItem | null>(null);
  const [query, setQuery] = useState('');
  const [githubOpen, setGithubOpen] = useState(false);

  const importFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: LocalItem[] = [];
    for (const file of Array.from(files)) {
      const ext = extension(file.name);
      const url = URL.createObjectURL(file);
      let text: string | undefined;
      if (textExtensions.has(ext) || file.type.startsWith('text/')) {
        try { text = await file.text(); } catch { text = undefined; }
      }
      next.push({ id: crypto.randomUUID(), name: file.name, type: file.type || ext, size: file.size, url, text });
    }
    setItems((current) => [...next, ...current]);
    if (next[0]) setSelected(next[0]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => !q || item.name.toLowerCase().includes(q));
  }, [items, query]);

  const selectedExt = selected ? extension(selected.name) : '';

  return (
    <div className="h-full min-h-[calc(100dvh-8rem)] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1016] overflow-hidden flex flex-col">
      <header className="min-h-12 shrink-0 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 flex items-center gap-2">
        <IconFile className="h-4 w-4 text-blue-500" />
        <div className="text-sm font-medium">Leitor</div>
        <span className="text-[10px] text-slate-500 hidden sm:inline">arquivos locais + GitHub</span>
        <div className="ml-auto flex items-center gap-1.5">
          <label className="h-8 px-2.5 rounded-lg bg-blue-600 text-white text-[10px] font-medium inline-flex items-center gap-1.5 cursor-pointer">
            <IconUpload className="h-3.5 w-3.5" /> Abrir
            <input type="file" multiple className="sr-only" onChange={(e) => void importFiles(e.target.files)} />
          </label>
          <button type="button" onClick={() => setGithubOpen(true)} className="h-8 px-2.5 rounded-lg border border-slate-700/60 text-[10px] font-medium inline-flex items-center gap-1.5 hover:bg-white/5">
            <IconBrandGithub className="h-3.5 w-3.5" /> GitHub
          </button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="min-h-0 border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-2.5 border-b border-slate-200 dark:border-slate-800">
            <div className="relative"><IconSearch className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar arquivos" className="w-full h-8 rounded-lg border border-slate-700/50 bg-transparent pl-8 pr-2 text-[10px] outline-none" /></div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {!filtered.length ? <div className="px-3 py-10 text-center text-[10px] text-slate-500"><IconFolder className="mx-auto h-6 w-6 mb-2 opacity-40" />Abra arquivos do dispositivo para começar.</div> : filtered.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelected(item)} className={`w-full rounded-lg px-2.5 py-2 text-left flex items-center gap-2 ${selected?.id === item.id ? 'bg-blue-500/10 text-blue-300' : 'hover:bg-white/5'}`}>
                {imageExtensions.has(extension(item.name)) ? <IconPhoto className="h-3.5 w-3.5 shrink-0" /> : <IconFileText className="h-3.5 w-3.5 shrink-0" />}
                <span className="min-w-0 flex-1 truncate text-[10px]">{item.name}</span>
              </button>
            ))}
          </div>
        </aside>
        <main className="min-w-0 min-h-0 flex flex-col">
          {!selected ? <div className="flex-1 flex items-center justify-center p-8 text-center"><div className="max-w-sm"><IconFile className="mx-auto h-10 w-10 text-slate-600" /><h2 className="mt-3 text-sm font-medium">Escolha um arquivo</h2><p className="mt-1 text-[11px] leading-relaxed text-slate-500">O Orbit agora é um leitor: abra arquivos, navegue pelo conteúdo e use o Nexus AI para compreender o que está vendo.</p></div></div> : (
            <>
              <div className="min-h-11 shrink-0 border-b border-slate-200 dark:border-slate-800 px-3 flex items-center gap-2"><span className="text-[11px] font-medium truncate">{selected.name}</span><span className="text-[9px] text-slate-500">{Math.round(selected.size / 1024)} KB</span><button type="button" disabled={!selected.text} onClick={() => { window.dispatchEvent(new CustomEvent('orbit:nexus-context', { detail: { text: selected.text, title: selected.name } })); window.dispatchEvent(new Event('orbit:navigate-chat')); }} className="ml-auto h-8 px-2.5 rounded-lg bg-violet-600 text-white text-[10px] font-medium disabled:opacity-30">Perguntar ao Nexus</button></div>
              <div className="min-h-0 flex-1 overflow-auto bg-slate-50 dark:bg-[#090C12]">
                {selected.text ? <pre className="m-0 p-4 sm:p-6 whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-slate-200">{selected.text}</pre>
                  : imageExtensions.has(selectedExt) ? <div className="min-h-full p-4 flex items-center justify-center"><img src={selected.url} alt={selected.name} className="max-w-full max-h-full object-contain" /></div>
                  : selectedExt === 'pdf' ? <iframe title={selected.name} src={selected.url} className="w-full h-full min-h-[70vh] border-0 bg-white" />
                  : audioExtensions.has(selectedExt) ? <div className="p-8"><audio controls src={selected.url} className="w-full" /></div>
                  : videoExtensions.has(selectedExt) ? <div className="p-4 flex justify-center"><video controls src={selected.url} className="max-w-full max-h-[75vh]" /></div>
                  : <div className="p-8 text-center text-[11px] text-slate-500">Pré-visualização deste formato ainda não está disponível no leitor.</div>}
              </div>
            </>
          )}
        </main>
      </div>
      {githubOpen ? <GitHubProjectsWorkspace /> : null}
    </div>
  );
};
