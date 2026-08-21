import React, { useState } from 'react';
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  Music2,
  Video,
  X,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { OrbiDocLogo } from './OrbiDocLogo';

type Probe = {
  sourceUrl: string;
  finalUrl: string;
  fileName: string;
  contentType: string;
  contentLength?: number;
  kind: 'image' | 'audio' | 'video' | 'pdf' | 'archive' | 'file';
  downloadable: boolean;
  maxProxyBytes: number;
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return 'Tamanho não informado';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const iconForKind = (kind?: Probe['kind']) => {
  if (kind === 'image') return ImageIcon;
  if (kind === 'audio') return Music2;
  if (kind === 'video') return Video;
  if (kind === 'archive') return FileArchive;
  return FileText;
};

export const LinkDownloaderLauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [probe, setProbe] = useState<Probe | null>(null);
  const [busy, setBusy] = useState<'probe' | 'download' | null>(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    const value = url.trim();
    if (!value) return;
    setBusy('probe');
    setError('');
    setProbe(null);
    try {
      const response = await fetch('/api/media/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível analisar esse link.');
      setProbe(data as Probe);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível analisar esse link.');
    } finally {
      setBusy(null);
    }
  };

  const downloadFile = async () => {
    if (!probe) return;
    setBusy('download');
    setError('');
    try {
      const response = await fetch('/api/media/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: probe.finalUrl || probe.sourceUrl }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'O download não pôde ser concluído.');
      }
      const blob = await response.blob();
      const headerName = response.headers.get('x-orbidoc-filename');
      let fileName = probe.fileName || 'download';
      if (headerName) {
        try { fileName = decodeURIComponent(headerName); } catch { /* keep probe name */ }
      }
      saveAs(blob, fileName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'O download não pôde ser concluído.');
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setUrl('');
    setProbe(null);
    setError('');
  };

  const KindIcon = iconForKind(probe?.kind);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[72] left-4 bottom-[84px] lg:bottom-5 h-12 lg:h-11 px-3 lg:px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] text-slate-700 dark:text-white shadow-xl inline-flex items-center gap-2 text-[10px] font-black hover:border-[#3157F6]/40 active:scale-95 transition-transform"
        aria-label="Abrir downloads por link"
        title="Downloads por link"
      >
        <Link2 className="w-5 h-5 text-[#3157F6] dark:text-[#7AA2FF]" />
        <span className="hidden lg:inline">Links</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] shadow-2xl">
            <header className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <OrbiDocLogo size="sm" />
              <div className="min-w-0 flex-1"><h2 className="text-sm font-black">Download por link</h2><p className="text-[10px] text-slate-500 dark:text-slate-400">Arquivos diretos de imagem, áudio, vídeo, PDF e pacotes.</p></div>
              <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </header>

            <div className="p-5 space-y-4">
              <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Link direto</span><div className="mt-2 flex gap-2"><input value={url} onChange={(event) => { setUrl(event.target.value); setProbe(null); setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') void analyze(); }} placeholder="https://exemplo.com/arquivo.mp4" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs outline-none focus:border-[#3157F6]" /><button onClick={() => void analyze()} disabled={busy === 'probe' || !url.trim()} className="h-11 px-4 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black disabled:opacity-50 inline-flex items-center gap-2">{busy === 'probe' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Analisar</button></div></label>

              <div className="grid sm:grid-cols-3 gap-2 text-[9px]">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3"><ImageIcon className="w-4 h-4 text-[#3157F6]" /><div className="mt-2 font-black">Imagens</div><div className="mt-0.5 text-slate-400">JPG, PNG, WebP e outros tipos diretos.</div></div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3"><Music2 className="w-4 h-4 text-[#6D5EF7]" /><div className="mt-2 font-black">Áudio e vídeo</div><div className="mt-0.5 text-slate-400">MP3/AAC/MP4/WebM quando a URL já aponta ao arquivo.</div></div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3"><FileArchive className="w-4 h-4 text-[#008CA8]" /><div className="mt-2 font-black">Arquivos</div><div className="mt-0.5 text-slate-400">PDF, ZIP, EPUB e binários de download direto.</div></div>
              </div>

              {error && <div role="alert" className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-[10px] font-semibold text-rose-700 dark:text-rose-300">{error}</div>}

              {probe && <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 flex items-start gap-3 bg-slate-50 dark:bg-slate-950/60"><div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center"><KindIcon className="w-5 h-5 text-[#3157F6]" /></div><div className="min-w-0 flex-1"><div className="text-xs font-black break-all">{probe.fileName}</div><div className="mt-1 text-[9px] text-slate-400">{probe.contentType} · {formatBytes(probe.contentLength)}</div></div></div>
                <div className="p-4 flex flex-wrap gap-2">
                  {probe.downloadable ? <button onClick={() => void downloadFile()} disabled={busy === 'download'} className="h-10 px-4 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black inline-flex items-center gap-2 disabled:opacity-50">{busy === 'download' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar arquivo</button> : <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 text-[9px] text-amber-800 dark:text-amber-200">O arquivo informado é maior que o limite de proxy do OrbiDoc ({Math.round(probe.maxProxyBytes / 1024 / 1024)} MB). Use o endereço original.</div>}
                  <button onClick={() => window.open(probe.finalUrl, '_blank', 'noopener,noreferrer')} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Abrir origem</button>
                  <button onClick={reset} className="h-10 px-3 rounded-xl text-[10px] font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Limpar</button>
                </div>
              </div>}

              <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/25 p-4 flex items-start gap-3"><AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /><div className="text-[9px] leading-relaxed text-amber-800 dark:text-amber-200"><strong>Somente conteúdo que você tem direito de baixar.</strong> O OrbiDoc não extrai mídia de páginas, não contorna DRM, paywalls ou proteções de streaming e não converte páginas de serviços como YouTube, Spotify ou Netflix em arquivos.</div></div>
            </div>
          </section>
        </div>
      )}
    </>
  );
};
