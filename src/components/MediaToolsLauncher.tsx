import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, ExternalLink, Image as ImageIcon, Link, Sparkles, Upload, X } from 'lucide-react';
import { saveAs } from 'file-saver';
import { enhanceImageLocally, type EnhancementProfile, type EnhancementScale } from '../lib/imageEnhancer';
import { OrbiDocLogo } from './OrbiDocLogo';

type Tab = 'enhance' | 'links';
type OutputType = 'image/png' | 'image/jpeg' | 'image/webp';

const PROFILE_LABELS: Array<{ id: EnhancementProfile; label: string; detail: string }> = [
  { id: 'balanced', label: 'Equilibrado', detail: 'Contraste e nitidez moderados' },
  { id: 'photo', label: 'Foto', detail: 'Tons e detalhes naturais' },
  { id: 'anime', label: 'Anime / arte', detail: 'Linhas e cores mais definidas' },
  { id: 'document', label: 'Documento', detail: 'Texto e fundo mais limpos' },
  { id: 'sharp', label: 'Nitidez forte', detail: 'Recuperação agressiva de contornos' },
];

const extensionForMime = (mime: string) => mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';

function safeFileName(value: string, fallback = 'arquivo') {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  return cleaned || fallback;
}

function fileNameFromUrl(value: string) {
  try {
    const url = new URL(value);
    const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || 'download');
    return safeFileName(last, 'download');
  } catch {
    return 'download';
  }
}

function validPublicHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const MediaToolsLauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('enhance');

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[70] left-4 bottom-[84px] lg:bottom-5 h-12 lg:h-11 px-3 lg:px-4 rounded-2xl bg-white dark:bg-[#101827] border border-slate-200 dark:border-slate-700 shadow-xl text-slate-700 dark:text-slate-100 inline-flex items-center gap-2 text-[10px] font-black hover:border-[#3157F6]/40 active:scale-95 transition-transform"
        title="Mídia & qualidade · Ctrl+Shift+M"
        aria-label="Abrir ferramentas de mídia e qualidade"
      >
        <Sparkles className="w-5 h-5 text-[#3157F6] dark:text-[#7AA2FF]" />
        <span className="hidden lg:inline">Mídia & qualidade</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] bg-[#F7F9FC] dark:bg-[#080D18] flex flex-col">
          <header className="h-14 shrink-0 px-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#101827]/95 backdrop-blur flex items-center gap-3">
            <OrbiDocLogo size="sm" />
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="min-w-0 flex-1"><div className="text-xs font-black">Mídia & qualidade</div><div className="text-[9px] text-slate-400">Aprimoramento local e downloads diretos</div></div>
            <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar"><X className="w-4 h-4" /></button>
          </header>

          <nav className="px-3 sm:px-5 pt-3 flex gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827]">
            <TabButton active={tab === 'enhance'} onClick={() => setTab('enhance')} icon={<ImageIcon className="w-4 h-4" />} label="Aprimorar imagem" />
            <TabButton active={tab === 'links'} onClick={() => setTab('links')} icon={<Link className="w-4 h-4" />} label="Baixar por link" />
          </nav>

          <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
            {tab === 'enhance' ? <ImageEnhancementStudio /> : <DirectLinkDownloader />}
          </main>
        </div>
      )}
    </>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button type="button" onClick={onClick} className={`h-10 px-3 rounded-t-xl text-[10px] font-black inline-flex items-center gap-2 border-b-2 ${active ? 'border-[#3157F6] text-[#3157F6] dark:text-[#7AA2FF]' : 'border-transparent text-slate-500'}`}>{icon}{label}</button>
);

const ImageEnhancementStudio: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultMeta, setResultMeta] = useState('');
  const [profile, setProfile] = useState<EnhancementProfile>('balanced');
  const [scale, setScale] = useState<EnhancementScale>(2);
  const [strength, setStrength] = useState(65);
  const [outputType, setOutputType] = useState<OutputType>('image/png');
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState(50);
  const [notice, setNotice] = useState('');

  useEffect(() => () => {
    if (sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
    if (resultUrl.startsWith('blob:')) URL.revokeObjectURL(resultUrl);
  }, []);

  const selectFile = (next?: File) => {
    if (!next) return;
    if (!next.type.startsWith('image/')) { setNotice('Selecione um arquivo de imagem.'); return; }
    if (next.size > 40 * 1024 * 1024) { setNotice('Use uma imagem de até 40 MB para preservar a estabilidade do navegador.'); return; }
    if (sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
    if (resultUrl.startsWith('blob:')) URL.revokeObjectURL(resultUrl);
    setFile(next);
    setSourceUrl(URL.createObjectURL(next));
    setResultUrl('');
    setResultBlob(null);
    setResultMeta('');
    setNotice('');
  };

  const run = async () => {
    if (!file) { setNotice('Selecione uma imagem primeiro.'); return; }
    setBusy(true);
    setNotice('');
    try {
      const result = await enhanceImageLocally(file, { scale, profile, strength, outputType, quality: 0.96 });
      if (resultUrl.startsWith('blob:')) URL.revokeObjectURL(resultUrl);
      const url = URL.createObjectURL(result.blob);
      setResultUrl(url);
      setResultBlob(result.blob);
      const effective = result.plan.effectiveScale.toFixed(result.plan.effectiveScale % 1 ? 2 : 0);
      setResultMeta(`${result.width}×${result.height} · escala efetiva ${effective}×${result.plan.capped ? ' · limitada para proteger a memória' : ''}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao aprimorar a imagem.');
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!resultBlob || !file) return;
    const base = safeFileName(file.name.replace(/\.[^/.]+$/, ''), 'OrbiDoc');
    saveAs(resultBlob, `${base}-aprimorada.${extensionForMime(outputType)}`);
  };

  return (
    <div className="max-w-[1500px] mx-auto grid xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
      <aside className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-4">
        <div><div className="text-xs font-black text-[#3157F6] dark:text-[#7AA2FF] inline-flex items-center gap-2"><Sparkles className="w-4 h-4" /> Aprimoramento profissional</div><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Upscale progressivo + auto níveis + tratamento específico por perfil + sharpening. Tudo local no dispositivo.</p></div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ''; }} />
        <button onClick={() => inputRef.current?.click()} className="w-full h-11 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#3157F6] text-[10px] font-black inline-flex items-center justify-center gap-2"><Upload className="w-4 h-4" /> {file ? 'Trocar imagem' : 'Selecionar imagem'}</button>
        {file && <div className="text-[9px] text-slate-500 truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</div>}

        <div><div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Perfil</div><div className="grid grid-cols-1 gap-1.5">{PROFILE_LABELS.map((item) => <button key={item.id} onClick={() => setProfile(item.id)} className={`rounded-xl border p-2.5 text-left ${profile === item.id ? 'border-[#3157F6] bg-[#EFF4FF] dark:bg-[#0D1E5B]/35' : 'border-slate-200 dark:border-slate-700'}`}><div className="text-[10px] font-black">{item.label}</div><div className="text-[8px] text-slate-400 mt-0.5">{item.detail}</div></button>)}</div></div>
        <div><div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Escala</div><div className="grid grid-cols-3 gap-1.5">{([1, 2, 4] as EnhancementScale[]).map((value) => <button key={value} onClick={() => setScale(value)} className={`h-9 rounded-xl border text-[10px] font-black ${scale === value ? 'border-[#3157F6] text-[#3157F6] bg-[#EFF4FF] dark:bg-[#0D1E5B]/35' : 'border-slate-200 dark:border-slate-700'}`}>{value}×</button>)}</div></div>
        <label className="block"><div className="flex justify-between text-[9px] font-black"><span>Força</span><span className="text-slate-400">{strength}%</span></div><input type="range" min={20} max={100} value={strength} onChange={(event) => setStrength(Number(event.target.value))} className="w-full accent-[#3157F6]" /></label>
        <select value={outputType} onChange={(event) => setOutputType(event.target.value as OutputType)} className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-[10px] font-bold"><option value="image/png">PNG sem perdas</option><option value="image/jpeg">JPG qualidade alta</option><option value="image/webp">WebP</option></select>
        {notice && <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[9px] font-semibold text-amber-800 dark:text-amber-200">{notice}</div>}
        <button disabled={!file || busy} onClick={() => void run()} className="w-full h-11 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black inline-flex items-center justify-center gap-2 disabled:opacity-40"><Sparkles className="w-4 h-4" /> {busy ? 'Aprimorando…' : 'Aprimorar imagem'}</button>
        {resultBlob && <button onClick={download} className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Baixar resultado</button>}
      </aside>

      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 min-h-[620px] overflow-hidden shadow-sm flex flex-col">
        <div className="h-12 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3"><div className="text-[10px] font-black flex-1">Comparação antes / depois</div>{resultUrl && <label className="text-[9px] font-bold inline-flex items-center gap-2">Divisor <input type="range" min={0} max={100} value={compare} onChange={(event) => setCompare(Number(event.target.value))} className="w-28 accent-[#3157F6]" /></label>}</div>
        <div className="flex-1 min-h-0 p-4 flex items-center justify-center">
          {!sourceUrl ? <div className="text-center text-slate-400"><ImageIcon className="w-16 h-16 mx-auto opacity-30" /><div className="mt-3 text-sm font-black">Escolha uma imagem</div><div className="mt-1 text-[10px]">A comparação aparecerá aqui.</div></div> : resultUrl ? <div className="relative max-w-full max-h-[720px] overflow-hidden rounded-2xl shadow-2xl bg-white"><img src={resultUrl} alt="Depois" className="block max-w-full max-h-[720px] object-contain" /><div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }}><img src={sourceUrl} alt="Antes" className="block w-full h-full object-contain" /></div><div className="absolute top-0 bottom-0 w-0.5 bg-white shadow" style={{ left: `${compare}%` }} /></div> : <img src={sourceUrl} alt="Original" className="max-w-full max-h-[720px] object-contain rounded-2xl shadow-2xl bg-white" />}
        </div>
        {resultMeta && <div className="h-10 px-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center text-[9px] text-slate-500">{resultMeta}</div>}
      </section>
    </div>
  );
};

const DirectLinkDownloader: React.FC = () => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const valid = useMemo(() => validPublicHttpUrl(url), [url]);

  const download = async () => {
    if (!valid) { setNotice('Use uma URL pública http:// ou https:// válida.'); return; }
    setBusy(true);
    setNotice('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(url.trim(), { mode: 'cors', credentials: 'omit', redirect: 'follow', signal: controller.signal });
      if (!response.ok) throw new Error(`O servidor respondeu ${response.status}.`);
      const length = Number(response.headers.get('content-length') || 0);
      if (length > 250 * 1024 * 1024) throw new Error('O arquivo informado excede o limite seguro de 250 MB para download via memória do navegador.');
      const blob = await response.blob();
      if (blob.size > 250 * 1024 * 1024) throw new Error('O arquivo excede o limite seguro de 250 MB.');
      const finalName = safeFileName(name.trim() || fileNameFromUrl(response.url || url), 'download');
      saveAs(blob, finalName);
      setNotice(`Download preparado: ${finalName} · ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError' ? 'O download excedeu o tempo limite.' : error instanceof Error ? error.message : 'Falha ao baixar o arquivo.';
      setNotice(`${message} Se a origem bloquear CORS, use “Abrir link” para baixar pelo próprio servidor de origem.`);
    } finally {
      window.clearTimeout(timer);
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
        <div className="text-xs font-black text-[#3157F6] dark:text-[#7AA2FF] inline-flex items-center gap-2"><Link className="w-4 h-4" /> Download direto por URL</div>
        <h1 className="mt-1 text-2xl font-black">Baixe arquivos públicos sem intermediários</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Indicado para URLs diretas de imagens, vídeos, áudios, PDFs, ZIPs e outros arquivos que você tem permissão para baixar. O OrbiDoc não extrai conteúdo de páginas de streaming nem contorna DRM/proteções.</p>
      </section>

      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <label className="block"><span className="text-[9px] font-black uppercase tracking-wider text-slate-400">URL direta</span><input value={url} onChange={(event) => { setUrl(event.target.value); setNotice(''); }} placeholder="https://exemplo.com/video.mp4" inputMode="url" className="mt-2 w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-sm outline-none focus:border-[#3157F6]" /></label>
        <label className="block"><span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Nome do arquivo (opcional)</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="meu-video.mp4" className="mt-2 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-[11px] outline-none focus:border-[#3157F6]" /></label>
        {notice && <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-[9px] leading-relaxed text-slate-600 dark:text-slate-300">{notice}</div>}
        <div className="flex flex-wrap gap-2">
          <button disabled={!valid || busy} onClick={() => void download()} className="h-10 px-4 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] text-white text-[10px] font-black inline-flex items-center gap-2 disabled:opacity-40"><Download className="w-4 h-4" /> {busy ? 'Baixando…' : 'Baixar arquivo'}</button>
          <button disabled={!valid} onClick={() => window.open(url.trim(), '_blank', 'noopener,noreferrer')} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2 disabled:opacity-40"><ExternalLink className="w-4 h-4" /> Abrir link</button>
          <button disabled={!valid} onClick={() => navigator.clipboard?.writeText(url.trim()).then(() => setNotice('Link copiado.')).catch(() => setNotice('Não foi possível copiar o link.'))} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2 disabled:opacity-40"><Copy className="w-4 h-4" /> Copiar</button>
        </div>
      </section>
    </div>
  );
};
