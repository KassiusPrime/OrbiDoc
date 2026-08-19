import React, { useMemo, useRef, useState } from 'react';
import {
  IconDownload as Download,
  IconEdit as Edit,
  IconPhoto as Photo,
  IconPhotoPlus as PhotoPlus,
  IconRefresh as Refresh,
  IconSparkles as Sparkles,
  IconTrash as Trash,
  IconUpload as Upload,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { HistoryItem } from '../types';

interface ImageWorkspaceProps {
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSendToCanva?: (imageDataUrl?: string) => void;
}

type Mode = 'generate' | 'edit';
type OutputFormat = 'png' | 'jpg' | 'webp' | 'avif';

type ImageResult = {
  id: string;
  imageUrl: string;
  prompt: string;
  provider: string;
  model: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  createdAt: string;
};

const PRESETS = [
  { id: 'square', label: 'Quadrado', width: 1024, height: 1024 },
  { id: 'portrait', label: 'Retrato', width: 896, height: 1152 },
  { id: 'landscape', label: 'Paisagem', width: 1152, height: 896 },
  { id: 'story', label: 'Story', width: 768, height: 1365 },
  { id: 'wide', label: '16:9', width: 1344, height: 768 },
];

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Não foi possível decodificar a imagem gerada.'));
  image.src = src;
});

async function imageDataToBlob(dataUrl: string, format: OutputFormat, quality = 0.94) {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível.');

  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0);
  const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error(`Este navegador não conseguiu codificar ${format.toUpperCase()}.`)), mime, quality));
  if (format === 'avif' && blob.type !== 'image/avif') throw new Error('Este navegador não oferece codificação AVIF. Use PNG, JPG ou WebP.');
  return blob;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({
  onSaveToHistory,
  showNotification = () => {},
  onSendToCanva,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('generate');
  const [prompt, setPrompt] = useState('');
  const [presetId, setPresetId] = useState('square');
  const [referenceImage, setReferenceImage] = useState<string>('');
  const [referenceName, setReferenceName] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<OutputFormat>('png');

  const active = results.find((item) => item.id === activeId) || results[0] || null;
  const preset = PRESETS.find((item) => item.id === presetId) || PRESETS[0];
  const resultMeta = useMemo(() => active ? `${active.provider} · ${active.model}` : 'Nenhuma imagem gerada', [active]);

  const uploadReference = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Selecione PNG, JPG, WebP ou AVIF.', 'error');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showNotification('A imagem de referência precisa ter menos de 15 MB.', 'error');
      return;
    }
    try {
      setReferenceImage(await readAsDataUrl(file));
      setReferenceName(file.name);
      setMode('edit');
    } catch {
      showNotification('Falha ao carregar a imagem.', 'error');
    }
  };

  const createResult = (data: any, originalPrompt: string) => {
    const result: ImageResult = {
      id: crypto.randomUUID(),
      imageUrl: String(data.imageUrl || ''),
      prompt: originalPrompt,
      provider: String(data.provider || 'desconhecido'),
      model: String(data.model || data.provider || 'desconhecido'),
      fallbackUsed: Boolean(data.fallbackUsed),
      fallbackReason: data.fallbackReason ? String(data.fallbackReason) : undefined,
      createdAt: new Date().toISOString(),
    };
    if (!result.imageUrl.startsWith('data:image/')) throw new Error('O servidor não retornou uma imagem válida.');
    setResults((current) => [result, ...current].slice(0, 12));
    setActiveId(result.id);
    onSaveToHistory?.({
      type: 'image',
      title: mode === 'edit' ? `Imagem editada: ${referenceName || 'referência'}` : 'Imagem gerada por IA',
      summary: originalPrompt.slice(0, 180),
      details: `Provedor: ${result.provider}\nModelo: ${result.model}${result.fallbackUsed ? `\nFallback: ${result.fallbackReason || 'sim'}` : ''}`,
      mediaUrl: result.imageUrl,
      tags: ['Imagem', 'IA', result.provider],
    });
    return result;
  };

  const run = async () => {
    if (!prompt.trim()) {
      showNotification('Descreva a imagem ou a edição desejada.', 'error');
      return;
    }
    if (mode === 'edit' && !referenceImage) {
      showNotification('Envie uma imagem para editar.', 'error');
      return;
    }
    setBusy(true);
    try {
      const endpoint = mode === 'edit' ? '/api/edit-image' : '/api/generate-image';
      const body = mode === 'edit'
        ? { image: referenceImage, prompt: prompt.trim() }
        : { prompt: prompt.trim(), width: preset.width, height: preset.height, model: 'flux' };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Falha no servidor (${response.status}).`);
      const result = createResult(data, prompt.trim());
      showNotification(result.fallbackUsed ? `Imagem criada por ${result.provider} após fallback.` : `Imagem criada por ${result.provider}.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao gerar imagem.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!active) return;
    try {
      const blob = await imageDataToBlob(active.imageUrl, downloadFormat);
      saveAs(blob, `DocSwiss_Imagem_${new Date(active.createdAt).toISOString().replace(/[:.]/g, '-')}.${downloadFormat}`);
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao converter a imagem.', 'error');
    }
  };

  const sendToDesign = () => {
    if (!active || !onSendToCanva) return;
    try {
      sessionStorage.setItem('docswiss_design_import_image', active.imageUrl);
      onSendToCanva(active.imageUrl);
      showNotification('Imagem enviada para o Design.', 'success');
    } catch {
      showNotification('A imagem é grande demais para transferência direta. Baixe e importe no Design.', 'error');
    }
  };

  return (
    <div className="max-w-[1500px] mx-auto space-y-5">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center gap-5">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400"><Sparkles className="w-4 h-4" /> Estúdio de imagens</div>
            <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Gerar e editar imagens com IA</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">O resultado mostra o provedor e o modelo que realmente responderam. Quando houver fallback, ele fica explícito.</p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-950 rounded-xl p-1">
            <button onClick={() => setMode('generate')} className={`h-9 px-3 rounded-lg text-xs font-black inline-flex items-center gap-2 ${mode === 'generate' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'}`}><PhotoPlus className="w-4 h-4" /> Gerar</button>
            <button onClick={() => setMode('edit')} className={`h-9 px-3 rounded-lg text-xs font-black inline-flex items-center gap-2 ${mode === 'edit' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'}`}><Edit className="w-4 h-4" /> Editar</button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <aside className="xl:col-span-4 space-y-4">
          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            {mode === 'edit' && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Imagem de referência</div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" onChange={(event) => { void uploadReference(event.target.files?.[0]); event.target.value = ''; }} />
                {referenceImage ? <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950"><img src={referenceImage} alt="Referência" className="w-full max-h-52 object-contain" /><button onClick={() => { setReferenceImage(''); setReferenceName(''); }} className="absolute right-2 top-2 w-8 h-8 rounded-xl bg-black/60 text-white flex items-center justify-center"><Trash className="w-4 h-4" /></button><div className="px-3 py-2 text-[10px] text-slate-500 truncate">{referenceName}</div></div> : <button onClick={() => fileRef.current?.click()} className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 flex flex-col items-center justify-center text-slate-400"><Upload className="w-6 h-6" /><span className="mt-2 text-xs font-bold">Enviar imagem</span></button>}
              </div>
            )}

            <label className="block"><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">{mode === 'edit' ? 'Instrução de edição' : 'Descrição'}</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm leading-relaxed outline-none focus:border-indigo-500" placeholder={mode === 'edit' ? 'Ex.: remova o fundo, mantenha a pessoa e use iluminação cinematográfica…' : 'Descreva a cena, estilo, composição, luz e detalhes desejados…'} /></label>

            {mode === 'generate' && <div><div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Formato</div><div className="grid grid-cols-2 gap-2">{PRESETS.map((item) => <button key={item.id} onClick={() => setPresetId(item.id)} className={`rounded-xl border p-2.5 text-left ${presetId === item.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700'}`}><div className="text-[10px] font-black">{item.label}</div><div className="text-[9px] text-slate-400 mt-0.5">{item.width}×{item.height}</div></button>)}</div></div>}

            <button onClick={run} disabled={busy} className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-black inline-flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" />{busy ? (mode === 'edit' ? 'Editando…' : 'Gerando…') : (mode === 'edit' ? 'Aplicar edição' : 'Gerar imagem')}</button>
          </section>
        </aside>

        <section className="xl:col-span-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col min-h-[620px]">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3"><div className="flex-1"><h2 className="text-sm font-black">Resultado</h2><div className="text-[10px] text-slate-400 mt-0.5">{resultMeta}</div></div>{active && <><select value={downloadFormat} onChange={(event) => setDownloadFormat(event.target.value as OutputFormat)} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-[10px] font-bold"><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option><option value="avif">AVIF</option></select><button onClick={download} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2"><Download className="w-4 h-4" /> Baixar</button>{onSendToCanva && <button onClick={sendToDesign} className="h-9 px-3 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300 text-[10px] font-black">Abrir no Design</button>}</>}</div>

          <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 flex items-center justify-center">
            {active ? <div className="max-w-full max-h-full"><img src={active.imageUrl} alt={active.prompt} className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-xl" />{active.fallbackUsed && <div className="mt-3 max-w-2xl mx-auto rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 px-3 py-2 text-[10px] text-amber-800 dark:text-amber-200"><strong>Fallback usado.</strong> {active.fallbackReason || `Resposta gerada por ${active.provider}.`}</div>}</div> : <div className="text-center text-slate-400"><Photo className="w-14 h-14 mx-auto opacity-40" /><h3 className="mt-4 text-sm font-black text-slate-600 dark:text-slate-300">Nenhum resultado ainda</h3><p className="mt-1 text-xs">A imagem gerada ou editada aparecerá aqui.</p></div>}
          </div>

          {results.length > 1 && <div className="p-3 border-t border-slate-100 dark:border-slate-800 overflow-x-auto flex gap-2">{results.map((item) => <button key={item.id} onClick={() => setActiveId(item.id)} className={`w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 ${item.id === active?.id ? 'border-indigo-500' : 'border-transparent'}`} title={`${item.provider} · ${item.model}`}><img src={item.imageUrl} alt="" className="w-full h-full object-cover" /></button>)}</div>}
        </section>
      </div>
    </div>
  );
};
