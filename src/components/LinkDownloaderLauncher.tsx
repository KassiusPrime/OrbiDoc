import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileDown, Image, Link, LoaderCircle, Music, ShieldCheck, Video, X } from 'lucide-react';
import { saveAs } from 'file-saver';

const MAX_BROWSER_DOWNLOAD = 250 * 1024 * 1024;
const IMAGE_EXT = new Set(['png','jpg','jpeg','webp','avif','gif','bmp','svg','tif','tiff']);
const VIDEO_EXT = new Set(['mp4','webm','mov','m4v','ogv']);
const AUDIO_EXT = new Set(['mp3','wav','m4a','aac','ogg','flac','opus']);

type MediaKind = 'image' | 'video' | 'audio' | 'file' | 'unknown';

type Probe = {
  kind: MediaKind;
  contentType?: string;
  size?: number;
  fileName: string;
  previewUrl?: string;
  note?: string;
};

const formatBytes = (bytes?: number) => {
  if (!bytes || !Number.isFinite(bytes)) return 'tamanho desconhecido';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const safeName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 160) || 'OrbiDoc-download';

function urlInfo(raw: string) {
  const url = new URL(raw.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use um link HTTP ou HTTPS válido.');
  const tail = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || 'download');
  const extension = tail.includes('.') ? tail.split('.').pop()!.toLowerCase() : '';
  const kind: MediaKind = IMAGE_EXT.has(extension) ? 'image' : VIDEO_EXT.has(extension) ? 'video' : AUDIO_EXT.has(extension) ? 'audio' : extension ? 'file' : 'unknown';
  return { url, fileName: safeName(tail), kind };
}

function kindFromContentType(contentType: string, fallback: MediaKind): MediaKind {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.includes('text/html')) return 'unknown';
  return fallback === 'unknown' ? 'file' : fallback;
}

export const LinkDownloaderLauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [probe, setProbe] = useState<Probe | null>(null);
  const [busy, setBusy] = useState<'inspect' | 'download' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => () => {
    if (probe?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(probe.previewUrl);
  }, [probe?.previewUrl]);

  const canDownload = Boolean(probe && probe.kind !== 'unknown');
  const icon = useMemo(() => {
    if (probe?.kind === 'image') return Image;
    if (probe?.kind === 'video') return Video;
    if (probe?.kind === 'audio') return Music;
    return FileDown;
  }, [probe?.kind]);
  const KindIcon = icon;

  const inspect = async () => {
    setMessage('');
    setProbe(null);
    let info: ReturnType<typeof urlInfo>;
    try { info = urlInfo(url); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Link inválido.'); return; }
    setBusy('inspect');
    try {
      const response = await fetch(info.url.toString(), { method: 'HEAD', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(`Servidor respondeu ${response.status}.`);
      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const length = Number(response.headers.get('content-length') || 0) || undefined;
      const kind = kindFromContentType(contentType, info.kind);
      if (kind === 'unknown') {
        setProbe({ kind, contentType, size: length, fileName: info.fileName, note: 'O link parece apontar para uma página HTML, não para um arquivo de mídia direto.' });
        return;
      }
      setProbe({ kind, contentType, size: length, fileName: info.fileName });
    } catch {
      setProbe({
        kind: info.kind,
        fileName: info.fileName,
        note: info.kind === 'unknown'
          ? 'O servidor não permite inspeção CORS e a URL não possui extensão reconhecível. Abra o link para confirmar o arquivo.'
          : 'O servidor bloqueou a inspeção CORS. O OrbiDoc tentará o download direto somente se o navegador permitir.',
      });
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    let info: ReturnType<typeof urlInfo>;
    try { info = urlInfo(url); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Link inválido.'); return; }
    setBusy('download');
    setMessage('');
    try {
      const response = await fetch(info.url.toString(), { method: 'GET', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(`Servidor respondeu ${response.status}.`);
      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (contentType.includes('text/html')) throw new Error('Este link abriu uma página HTML. Use a URL direta do arquivo de mídia.');
      const length = Number(response.headers.get('content-length') || 0);
      if (length > MAX_BROWSER_DOWNLOAD) throw new Error('O arquivo excede 250 MB. Abra o link original e use o download oferecido pelo servidor.');
      const blob = await response.blob();
      if (blob.size > MAX_BROWSER_DOWNLOAD) throw new Error('O arquivo excede 250 MB.');
      const fallbackExt = contentType.startsWith('image/') ? contentType.slice(6).replace('jpeg', 'jpg') : contentType.startsWith('video/') ? contentType.slice(6) : contentType.startsWith('audio/') ? contentType.slice(6) : '';
      const name = info.fileName.includes('.') ? info.fileName : `${info.fileName}${fallbackExt ? `.${fallbackExt}` : ''}`;
      saveAs(blob, safeName(name));
      const previewable = contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/');
      setProbe((current) => ({
        ...(current || { kind: kindFromContentType(contentType, info.kind), fileName: name }),
        kind: kindFromContentType(contentType, info.kind),
        contentType,
        size: blob.size,
        fileName: name,
        previewUrl: previewable ? URL.createObjectURL(blob) : undefined,
        note: 'Download concluído no navegador.',
      }));
      setMessage('Download concluído.');
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} Se o servidor bloquear CORS, use “Abrir link”.` : 'Falha no download direto.');
    } finally {
      setBusy(null);
    }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed z-[70] left-4 bottom-[84px] lg:bottom-5 h-12 lg:h-11 px-3 lg:px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#101827] text-slate-700 dark:text-white shadow-xl inline-flex items-center gap-2 text-[10px] font-black hover:border-[#3157F6]/40 active:scale-95 transition-transform" aria-label="Abrir downloads por link" title="Downloads por link"><Link className="w-5 h-5 text-[#3157F6] dark:text-[#7AA2FF]" /><span className="hidden lg:inline">Links</span></button>

    {open && <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] shadow-2xl">
        <header className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-[#EFF4FF] dark:bg-[#0D1E5B]/50 flex items-center justify-center"><Link className="w-5 h-5 text-[#3157F6] dark:text-[#7AA2FF]" /></div><div className="min-w-0 flex-1"><h2 className="text-sm font-black">Download por link direto</h2><p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Imagens, áudios, vídeos e arquivos que o servidor de origem permite baixar.</p></div><button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar"><X className="w-4 h-4" /></button></header>

        <div className="p-5 space-y-4">
          <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">URL direta</span><div className="mt-2 flex gap-2"><input value={url} onChange={(event) => { setUrl(event.target.value); setProbe(null); setMessage(''); }} onKeyDown={(event) => { if (event.key === 'Enter') void inspect(); }} placeholder="https://exemplo.com/arquivo.mp4" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs outline-none focus:border-[#3157F6]" /><button onClick={() => void inspect()} disabled={busy === 'inspect' || !url.trim()} className="h-11 px-4 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black disabled:opacity-50 inline-flex items-center gap-2">{busy === 'inspect' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : 'Analisar'}</button></div></label>

          {probe && <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center"><KindIcon className="w-5 h-5 text-[#3157F6] dark:text-[#7AA2FF]" /></div><div className="min-w-0 flex-1"><div className="text-xs font-black truncate">{probe.fileName}</div><div className="text-[9px] text-slate-400 mt-0.5">{probe.kind.toUpperCase()} · {probe.contentType || 'tipo inferido'} · {formatBytes(probe.size)}</div></div></div>{probe.previewUrl && <div className="mt-3 rounded-xl overflow-hidden bg-black/90 max-h-72 flex items-center justify-center">{probe.kind === 'image' ? <img src={probe.previewUrl} alt="Prévia" className="max-w-full max-h-72 object-contain" /> : probe.kind === 'video' ? <video src={probe.previewUrl} controls className="max-w-full max-h-72" /> : probe.kind === 'audio' ? <audio src={probe.previewUrl} controls className="w-full m-4" /> : null}</div>}{probe.note && <div className="mt-3 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">{probe.note}</div>}</div>}

          {message && <div className={`rounded-xl px-3 py-2 text-[10px] font-semibold ${message.includes('concluído') ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200'}`}>{message}</div>}

          <div className="flex flex-wrap gap-2"><button onClick={() => void download()} disabled={!url.trim() || !canDownload || Boolean(busy)} className="h-11 px-4 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black inline-flex items-center gap-2 disabled:opacity-40">{busy === 'download' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar arquivo</button><button onClick={() => { try { window.open(urlInfo(url).url.toString(), '_blank', 'noopener,noreferrer'); } catch { setMessage('Link inválido.'); } }} disabled={!url.trim()} className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2 disabled:opacity-40"><ExternalLink className="w-4 h-4" /> Abrir origem</button></div>

          <div className="rounded-2xl bg-[#F7F9FC] dark:bg-[#080D18]/60 p-3 flex gap-2 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400"><ShieldCheck className="w-4 h-4 shrink-0 text-[#008CA8] dark:text-[#22D3EE]" /><span><strong>Sem proxy do OrbiDoc.</strong> O download ocorre diretamente entre seu navegador e o servidor do arquivo, respeitando CORS. Use apenas conteúdo seu, licenciado ou que o site permita baixar. O OrbiDoc não extrai mídia de páginas nem contorna DRM, login, paywall ou proteção de streaming.</span></div>
        </div>
      </section>
    </div>}
  </>;
};
