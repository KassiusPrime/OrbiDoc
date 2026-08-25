import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArchive as Archive,
  IconDownload as Download,
  IconFile as FileIcon,
  IconFileZip as FileZip,
  IconFolder as Folder,
  IconFolderOpen as FolderOpen,
  IconPhoto as Photo,
  IconPlayerPlay as Play,
  IconSearch as Search,
  IconTrash as Trash,
  IconUpload as Upload,
} from '@tabler/icons-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type VirtualFile = {
  id: string;
  name: string;
  file: File;
  path: string;
  selected: boolean;
};

type ZipEntry = {
  name: string;
  dir: boolean;
  size?: number;
};

const bytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
};

const fileKind = (file: File) => file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') || file.type.startsWith('audio/') ? 'media' : file.name.toLowerCase().endsWith('.zip') ? 'zip' : 'file';

export const ArchiveFileManager: React.FC<{ showNotification?: (message: string, type?: 'success' | 'error') => void }> = ({ showNotification = () => {} }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [query, setQuery] = useState('');
  const [compression, setCompression] = useState(6);
  const [zipName, setZipName] = useState('OrbiDoc_Arquivos');
  const [zipEntries, setZipEntries] = useState<ZipEntry[]>([]);
  const [openedZip, setOpenedZip] = useState<JSZip | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const addFiles = (incoming: FileList | File[]) => {
    const next = Array.from(incoming).map((file) => ({ id: crypto.randomUUID(), name: file.name, file, path: (file as any).webkitRelativePath || file.name, selected: true }));
    setFiles((current) => [...current, ...next].slice(0, 500));
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return files.filter((item) => !needle || item.name.toLowerCase().includes(needle) || item.path.toLowerCase().includes(needle));
  }, [files, query]);

  const selected = files.filter((item) => item.selected);
  const totalBytes = selected.reduce((sum, item) => sum + item.file.size, 0);

  const preview = (item: VirtualFile) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(item.file);
    setPreviewUrl(URL.createObjectURL(item.file));
  };

  const createZip = async () => {
    if (!selected.length) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      for (const item of selected) zip.file(item.path || item.name, item.file);
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: compression } });
      saveAs(blob, `${zipName.trim() || 'OrbiDoc_Arquivos'}.zip`);
      showNotification(`ZIP criado com ${selected.length} arquivo(s): ${bytes(blob.size)}.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao criar ZIP.', 'error');
    } finally { setBusy(false); }
  };

  const openZip = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).map((entry) => ({ name: entry.name, dir: entry.dir }));
      setOpenedZip(zip);
      setZipEntries(entries);
      showNotification(`${entries.filter((entry) => !entry.dir).length} arquivo(s) encontrados no ZIP.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'ZIP inválido ou incompatível.', 'error');
    } finally { setBusy(false); }
  };

  const extractEntry = async (name: string) => {
    const entry = openedZip?.file(name);
    if (!entry) return;
    const blob = await entry.async('blob');
    saveAs(blob, name.split('/').filter(Boolean).pop() || 'arquivo');
  };

  const extractAll = async () => {
    if (!openedZip) return;
    setBusy(true);
    try {
      for (const entry of zipEntries.filter((item) => !item.dir)) {
        const file = openedZip.file(entry.name);
        if (!file) continue;
        const blob = await file.async('blob');
        saveAs(blob, entry.name.split('/').filter(Boolean).pop() || 'arquivo');
      }
      showNotification('Extração iniciada. O navegador pode solicitar autorização para vários downloads.', 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao extrair arquivos.', 'error');
    } finally { setBusy(false); }
  };

  const pickDirectory = async () => {
    const picker = (window as any).showDirectoryPicker;
    if (!picker) {
      showNotification('Acesso direto a pastas não é suportado neste navegador. Use “Adicionar arquivos”.', 'error');
      return;
    }
    try {
      const handle = await picker();
      const collected: File[] = [];
      const walk = async (dir: any, prefix = '') => {
        for await (const entry of dir.values()) {
          if (collected.length >= 500) break;
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            Object.defineProperty(file, 'webkitRelativePath', { value: `${prefix}${file.name}`, configurable: true });
            collected.push(file);
          } else if (entry.kind === 'directory') await walk(entry, `${prefix}${entry.name}/`);
        }
      };
      await walk(handle);
      addFiles(collected);
      showNotification(`${collected.length} arquivo(s) importados da pasta.`, 'success');
    } catch (error: any) {
      if (error?.name !== 'AbortError') showNotification(error?.message || 'Falha ao abrir pasta.', 'error');
    }
  };

  return <div className="orbidoc-files-studio max-w-[1500px] mx-auto space-y-4">
    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"><div className="flex flex-col lg:flex-row lg:items-center gap-4"><div className="flex-1"><div className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400"><FolderOpen className="w-4 h-4" /> Arquivos & compactação</div><h2 className="mt-1 text-2xl font-black">Gerenciador local</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Organize uma seleção local, visualize arquivos, crie e abra ZIPs. Todo processamento ocorre no dispositivo.</p></div><div className="flex flex-wrap gap-2"><input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} /><button onClick={() => inputRef.current?.click()} className="h-10 px-3 rounded-xl bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-2"><Upload className="w-4 h-4" /> Adicionar arquivos</button><button onClick={pickDirectory} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black inline-flex items-center gap-2"><Folder className="w-4 h-4" /> Abrir pasta</button><input ref={zipRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => { void openZip(event.target.files?.[0]); event.target.value = ''; }} /><button onClick={() => zipRef.current?.click()} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black inline-flex items-center gap-2"><FileZip className="w-4 h-4" /> Abrir ZIP</button></div></div></section>

    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <section className="xl:col-span-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"><div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2"><div className="relative flex-1 min-w-[220px]"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar na seleção…" className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-xs outline-none" /></div><button onClick={() => setFiles((current) => current.map((item) => ({ ...item, selected: true })))} className="h-10 px-3 rounded-xl border text-[10px] font-black">Selecionar tudo</button><button onClick={() => setFiles((current) => current.map((item) => ({ ...item, selected: false })))} className="h-10 px-3 rounded-xl border text-[10px] font-black">Limpar seleção</button></div><div className="max-h-[560px] overflow-auto divide-y divide-slate-100 dark:divide-slate-800">{filtered.length ? filtered.map((item) => { const kind = fileKind(item.file); const Icon = kind === 'image' ? Photo : kind === 'media' ? Play : kind === 'zip' ? FileZip : FileIcon; return <div key={item.id} className="px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"><input type="checkbox" checked={item.selected} onChange={(event) => setFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, selected: event.target.checked } : entry))} /><button onClick={() => preview(item)} className="min-w-0 flex-1 flex items-center gap-3 text-left"><div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Icon className="w-4 h-4" /></div><div className="min-w-0 flex-1"><div className="text-xs font-black truncate">{item.name}</div><div className="text-[9px] text-slate-400 truncate">{item.path} · {bytes(item.file.size)}</div></div></button><button onClick={() => saveAs(item.file, item.name)} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Baixar"><Download className="w-4 h-4 mx-auto" /></button><button onClick={() => setFiles((current) => current.filter((entry) => entry.id !== item.id))} className="w-8 h-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500" title="Remover da lista"><Trash className="w-4 h-4 mx-auto" /></button></div>; }) : <div className="p-14 text-center text-slate-400"><Folder className="w-12 h-12 mx-auto opacity-40" /><div className="mt-3 text-xs font-black">Nenhum arquivo na seleção</div></div>}</div></section>

      <aside className="xl:col-span-4 space-y-4"><section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"><div className="flex items-center gap-2"><Archive className="w-4 h-4 text-indigo-600" /><h3 className="text-sm font-black">Criar ZIP</h3></div><div className="mt-3 text-[10px] text-slate-500">{selected.length} arquivo(s) · {bytes(totalBytes)}</div><input value={zipName} onChange={(event) => setZipName(event.target.value)} className="mt-3 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs" aria-label="Nome do ZIP" /><label className="block mt-3 text-[10px] font-black text-slate-500">Compressão: {compression}/9<input type="range" min="1" max="9" value={compression} onChange={(event) => setCompression(Number(event.target.value))} className="mt-2 w-full" /></label><button disabled={busy || !selected.length} onClick={() => void createZip()} className="mt-3 w-full h-11 rounded-xl bg-indigo-600 text-white text-xs font-black disabled:opacity-40">{busy ? 'Processando…' : 'Compactar seleção'}</button><p className="mt-2 text-[9px] leading-relaxed text-slate-400">ZIP é suportado diretamente. RAR/7z e ZIP criptografado por senha exigem codecs adicionais e não são anunciados como disponíveis nesta versão.</p></section>

      {zipEntries.length > 0 && <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-sm font-black">Conteúdo do ZIP</h3><button onClick={() => void extractAll()} className="h-8 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[9px] font-black">Extrair tudo</button></div><div className="mt-3 max-h-56 overflow-auto space-y-1">{zipEntries.slice(0, 300).map((entry) => <div key={entry.name} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"><span className="min-w-0 flex-1 text-[9px] truncate">{entry.dir ? '📁 ' : ''}{entry.name}</span>{!entry.dir && <button onClick={() => void extractEntry(entry.name)} className="text-[9px] font-black text-indigo-600">Extrair</button>}</div>)}</div></section>}

      {previewFile && <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"><h3 className="text-sm font-black truncate">Prévia · {previewFile.name}</h3><div className="mt-3 rounded-2xl bg-slate-100 dark:bg-slate-950 min-h-36 overflow-hidden flex items-center justify-center">{previewFile.type.startsWith('image/') ? <img src={previewUrl} alt="Prévia" className="max-h-72 max-w-full object-contain" /> : previewFile.type.startsWith('video/') ? <video src={previewUrl} controls className="w-full max-h-72" /> : previewFile.type.startsWith('audio/') ? <audio src={previewUrl} controls className="w-full" /> : <div className="p-6 text-center text-[10px] text-slate-400">Prévia visual indisponível para este tipo. O arquivo continua disponível para download e compactação.</div>}</div></section>}
      </aside>
    </div>
  </div>;
};
