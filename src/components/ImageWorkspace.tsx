import React, { useMemo, useRef, useState } from 'react';
import {
  IconAdjustments as Adjustments,
  IconDownload as Download,
  IconEdit as Edit,
  IconPhoto as Photo,
  IconPhotoPlus as PhotoPlus,
  IconSparkles as Sparkles,
  IconTrash as Trash,
  IconUpload as Upload,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { enhanceImageLocally, type EnhancementProfile, type EnhancementScale } from '../lib/imageEnhancer';
import { HistoryItem } from '../types';

interface ImageWorkspaceProps {
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSendToCanva?: (imageDataUrl?: string) => void;
}

type Mode = 'generate' | 'edit' | 'enhance';
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
  dimensions?: string;
};

const PRESETS = [
  { id: 'square', label: 'Quadrado', width: 1024, height: 1024 },
  { id: 'portrait', label: 'Retrato', width: 896, height: 1152 },
  { id: 'landscape', label: 'Paisagem', width: 1152, height: 896 },
  { id: 'story', label: 'Story', width: 768, height: 1365 },
  { id: 'wide', label: '16:9', width: 1344, height: 768 },
];

const ENHANCE_PROFILES: Array<{ id: EnhancementProfile; label: string; description: string }> = [
  { id: 'photo', label: 'Foto', description: 'Nitidez e cor equilibradas' },
  { id: 'anime', label: 'Anime / ilustração', description: 'Contornos e cores mais firmes' },
  { id: 'document', label: 'Documento', description: 'Texto, contraste e legibilidade' },
];

const readAsDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Não foi possível decodificar a imagem.'));
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
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error(`Este navegador não conseguiu codificar ${format.toUpperCase()}.`)),
    mime,
    quality,
  ));
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
  const [referenceImage, setReferenceImage] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<OutputFormat>('png');
  const [enhanceProfile, setEnhanceProfile] = useState<EnhancementProfile>('photo');
  const [enhanceScale, setEnhanceScale] = useState<EnhancementScale>(2);
  const [enhanceStrength, setEnhanceStrength] = useState(60);

  const active = results.find((item) => item.id === activeId) || results[0] || null;
  const preset = PRESETS.find((item) => item.id === presetId) || PRESETS[0];
  const resultMeta = useMemo(() => active ? `${active.provider} · ${active.model}${active.dimensions ? ` · ${active.dimensions}` : ''}` : 'Nenhuma imagem processada', [active]);

  const uploadReference = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Selecione uma imagem compatível.', 'error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showNotification('A imagem precisa ter menos de 20 MB.', 'error');
      return;
    }
    try {
      setReferenceImage(await readAsDataUrl(file));
      setReferenceName(file.name);
      setReferenceFile(file);
    } catch {
      showNotification('Falha ao carregar a imagem.', 'error');
    }
  };

  const clearReference = () => {
    setReferenceImage('');
    setReferenceName('');
    setReferenceFile(null);
  };

  const registerResult = (result: ImageResult, historyTitle: string, historyDetails?: string) => {
    setResults((current) => [result, ...current].slice(0, 12));
    setActiveId(result.id);
    onSaveToHistory?.({
      type: 'image',
      title: historyTitle,
      summary: result.prompt.slice(0, 180),
      details: historyDetails || `Provedor: ${result.provider}\nModelo: ${result.model}${result.dimensions ? `\nDimensões: ${result.dimensions}` : ''}${result.fallbackUsed ? `\nFallback: ${result.fallbackReason || 'sim'}` : ''}`,
      mediaUrl: result.imageUrl,
      tags: ['Imagem', result.provider],
    });
    return result;
  };

  const createAiResult = (data: any, originalPrompt: string) => {
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
    return registerResult(result, mode === 'edit' ? `Imagem editada: ${referenceName || 'referência'}` : 'Imagem gerada por IA');
  };

  const runAi = async () => {
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
      const result = createAiResult(data, prompt.trim());
      showNotification(result.fallbackUsed ? `Imagem criada por ${result.provider} após fallback.` : `Imagem criada por ${result.provider}.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao processar imagem.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runLocalEnhancement = async () => {
    if (!referenceFile) {
      showNotification('Envie uma imagem para aprimorar.', 'error');
      return;
    }
    setBusy(true);
    try {
      const strength = enhanceStrength / 100;
      const enhanced = await enhanceImageLocally(referenceFile, {
        scale: enhanceScale,
        profile: enhanceProfile,
        sharpen: 0.08 + strength * (enhanceProfile === 'document' ? 0.30 : enhanceProfile === 'anime' ? 0.26 : 0.20),
        contrast: 1 + strength * (enhanceProfile === 'document' ? 0.18 : 0.06),
        saturation: enhanceProfile === 'document' ? 0.94 : 1 + strength * (enhanceProfile === 'anime' ? 0.08 : 0.035),
        maxPixels: 24_000_000,
        outputType: 'image/png',
        quality: 0.96,
      });
      const dataUrl = await readAsDataUrl(enhanced.blob);
      const result: ImageResult = {
        id: crypto.randomUUID(),
        imageUrl: dataUrl,
        prompt: `Aprimoramento HQ ${enhanceScale}× · perfil ${enhanceProfile}`,
        provider: 'local',
        model: 'OrbiDoc HQ Resample + Sharpen',
        createdAt: new Date().toISOString(),
        dimensions: `${enhanced.width}×${enhanced.height}`,
        fallbackUsed: enhanced.plan.capped,
        fallbackReason: enhanced.plan.capped ? `Saída limitada a ${Math.round(enhanced.plan.effectiveScale * 100) / 100}× para proteger a memória do dispositivo.` : undefined,
      };
      registerResult(result, `Imagem aprimorada: ${referenceName || 'imagem'}`, `Processamento local e determinístico.\nPerfil: ${enhanceProfile}\nEscala solicitada: ${enhanceScale}×\nEscala efetiva: ${enhanced.plan.effectiveScale.toFixed(2)}×\nSaída: ${enhanced.width}×${enhanced.height}`);
      showNotification(enhanced.plan.capped ? 'Imagem aprimorada; a resolução foi limitada para proteger a memória.' : `Imagem aprimorada em ${enhanceScale}×.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao aprimorar a imagem.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runAiRestoration = async () => {
    if (!referenceImage) {
      showNotification('Envie uma imagem para restauração por IA.', 'error');
      return;
    }
    setBusy(true);
    try {
      const profileInstruction = enhanceProfile === 'anime'
        ? 'Preserve exatamente o traço, as cores, as proporções e o design do personagem. Remova artefatos de compressão e reconstrua somente detalhes de linha que estejam degradados.'
        : enhanceProfile === 'document'
          ? 'Preserve o texto e a geometria. Melhore legibilidade, contraste e nitidez sem alterar palavras, números, assinaturas ou conteúdo.'
          : 'Preserve identidade, composição, cores e textura natural. Remova ruído e artefatos e recupere detalhes sutis sem mudar a cena.';
      const response = await fetch('/api/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: referenceImage, prompt: `Restaure a qualidade desta imagem. ${profileInstruction}` }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Falha no servidor (${response.status}).`);
      const result = createAiResult(data, `Restauração IA · ${enhanceProfile}`);
      showNotification(`Restauração IA concluída por ${result.provider}.`, 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Restauração IA indisponível.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!active) return;
    try {
      const blob = await imageDataToBlob(active.imageUrl, downloadFormat);
      saveAs(blob, `OrbiDoc_Imagem_${new Date(active.createdAt).toISOString().replace(/[:.]/g, '-')}.${downloadFormat}`);
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao converter a imagem.', 'error');
    }
  };

  const sendToDesign = () => {
    if (!active || !onSendToCanva) return;
    try {
      sessionStorage.setItem('orbidoc_design_import_image', active.imageUrl);
      onSendToCanva(active.imageUrl);
      showNotification('Imagem enviada para o Design.', 'success');
    } catch {
      showNotification('A imagem é grande demais para transferência direta. Baixe e importe no Design.', 'error');
    }
  };

  const needsReference = mode === 'edit' || mode === 'enhance';

  return (
    <div className="max-w-[1500px] mx-auto space-y-5">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center gap-5">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400"><Sparkles className="w-4 h-4" /> Estúdio de imagens</div>
            <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Gerar, editar e aprimorar imagens</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">Aprimoramento HQ local preserva o original. Restauração IA é opcional e pode reconstruir microdetalhes.</p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-950 rounded-xl p-1 overflow-x-auto">
            <button onClick={() => setMode('generate')} className={`h-9 px-3 rounded-lg text-xs font-black inline-flex items-center gap-2 whitespace-nowrap ${mode === 'generate' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'}`}><PhotoPlus className="w-4 h-4" /> Gerar</button>
            <button onClick={() => setMode('edit')} className={`h-9 px-3 rounded-lg text-xs font-black inline-flex items-center gap-2 whitespace-nowrap ${mode === 'edit' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'}`}><Edit className="w-4 h-4" /> Editar</button>
            <button onClick={() => setMode('enhance')} className={`h-9 px-3 rounded-lg text-xs font-black inline-flex items-center gap-2 whitespace-nowrap ${mode === 'enhance' ? 'bg-white dark:bg-slate-800 shadow-sm text-[#3157F6]' : 'text-slate-500'}`}><Adjustments className="w-4 h-4" /> Aprimorar</button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <aside className="xl:col-span-4 space-y-4">
          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            {needsReference && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Imagem de origem</div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/bmp,image/gif" className="hidden" onChange={(event) => { void uploadReference(event.target.files?.[0]); event.target.value = ''; }} />
                {referenceImage ? <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950"><img src={referenceImage} alt="Origem" className="w-full max-h-52 object-contain" /><button onClick={clearReference} className="absolute right-2 top-2 w-8 h-8 rounded-xl bg-black/60 text-white flex items-center justify-center"><Trash className="w-4 h-4" /></button><div className="px-3 py-2 text-[10px] text-slate-500 truncate">{referenceName}</div></div> : <button onClick={() => fileRef.current?.click()} className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 flex flex-col items-center justify-center text-slate-400"><Upload className="w-6 h-6" /><span className="mt-2 text-xs font-bold">Enviar imagem</span></button>}
              </div>
            )}

            {mode !== 'enhance' && <label className="block"><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">{mode === 'edit' ? 'Instrução de edição' : 'Descrição'}</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={7} className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm leading-relaxed outline-none focus:border-indigo-500" placeholder={mode === 'edit' ? 'Ex.: remova o fundo, preserve a pessoa e use iluminação cinematográfica…' : 'Descreva a cena, estilo, composição, luz e detalhes desejados…'} /></label>}

            {mode === 'generate' && <div><div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Formato</div><div className="grid grid-cols-2 gap-2">{PRESETS.map((item) => <button key={item.id} onClick={() => setPresetId(item.id)} className={`rounded-xl border p-2.5 text-left ${presetId === item.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-700'}`}><div className="text-[10px] font-black">{item.label}</div><div className="text-[9px] text-slate-400 mt-0.5">{item.width}×{item.height}</div></button>)}</div></div>}

            {mode === 'enhance' && <>
              <div><div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Perfil</div><div className="space-y-2">{ENHANCE_PROFILES.map((item) => <button key={item.id} onClick={() => setEnhanceProfile(item.id)} className={`w-full rounded-xl border px-3 py-2.5 text-left ${enhanceProfile === item.id ? 'border-[#3157F6] bg-[#EFF4FF] dark:bg-[#0D1E5B]/30' : 'border-slate-200 dark:border-slate-700'}`}><div className="text-[10px] font-black">{item.label}</div><div className="text-[9px] text-slate-400">{item.description}</div></button>)}</div></div>
              <div><div className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Escala</div><div className="grid grid-cols-3 gap-2">{([1, 2, 4] as EnhancementScale[]).map((scale) => <button key={scale} onClick={() => setEnhanceScale(scale)} className={`h-9 rounded-xl border text-[10px] font-black ${enhanceScale === scale ? 'border-[#3157F6] text-[#3157F6] bg-[#EFF4FF] dark:bg-[#0D1E5B]/30' : 'border-slate-200 dark:border-slate-700'}`}>{scale}×</button>)}</div></div>
              <label className="block"><div className="flex items-center justify-between text-[10px] font-black"><span>Intensidade</span><span className="text-slate-400">{enhanceStrength}%</span></div><input type="range" min={20} max={100} step={5} value={enhanceStrength} onChange={(event) => setEnhanceStrength(Number(event.target.value))} className="mt-2 w-full accent-[#3157F6]" /></label>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-[9px] leading-relaxed text-slate-500 dark:text-slate-400"><strong className="text-slate-700 dark:text-slate-200">HQ local:</strong> reamostragem progressiva, correção tonal e nitidez determinística. Saídas muito grandes são limitadas para evitar travamentos em celulares.</div>
            </>}

            {mode === 'enhance' ? <div className="grid gap-2"><button onClick={runLocalEnhancement} disabled={busy} className="w-full h-12 rounded-xl bg-[#3157F6] hover:bg-[#2446D8] disabled:opacity-50 text-white text-sm font-black inline-flex items-center justify-center gap-2"><Adjustments className="w-4 h-4" />{busy ? 'Processando…' : 'Aprimorar HQ local'}</button><button onClick={runAiRestoration} disabled={busy} className="w-full h-10 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-black inline-flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Restauração IA opcional</button><p className="text-[9px] text-slate-400 leading-relaxed">A restauração IA pode reconstruir detalhes. Para documentos oficiais ou imagens em que fidelidade é crítica, prefira HQ local.</p></div> : <button onClick={runAi} disabled={busy} className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-black inline-flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" />{busy ? (mode === 'edit' ? 'Editando…' : 'Gerando…') : (mode === 'edit' ? 'Aplicar edição' : 'Gerar imagem')}</button>}
          </section>
        </aside>

        <section className="xl:col-span-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col min-h-[620px]">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3"><div className="flex-1 min-w-[180px]"><h2 className="text-sm font-black">Resultado</h2><div className="text-[10px] text-slate-400 mt-0.5">{resultMeta}</div></div>{active && <><select value={downloadFormat} onChange={(event) => setDownloadFormat(event.target.value as OutputFormat)} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-[10px] font-bold"><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option><option value="avif">AVIF</option></select><button onClick={download} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-2"><Download className="w-4 h-4" /> Baixar</button>{onSendToCanva && <button onClick={sendToDesign} className="h-9 px-3 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300 text-[10px] font-black">Abrir no Design</button>}</>}</div>
          <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 flex items-center justify-center">
            {active ? <div className="max-w-full max-h-full"><img src={active.imageUrl} alt={active.prompt} className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-xl" />{active.fallbackUsed && <div className="mt-3 max-w-2xl mx-auto rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 px-3 py-2 text-[10px] text-amber-800 dark:text-amber-200"><strong>Ajuste aplicado.</strong> {active.fallbackReason || `Resposta gerada por ${active.provider}.`}</div>}</div> : <div className="text-center text-slate-400"><Photo className="w-14 h-14 mx-auto opacity-40" /><h3 className="mt-4 text-sm font-black text-slate-600 dark:text-slate-300">Nenhum resultado ainda</h3><p className="mt-1 text-xs">A imagem gerada, editada ou aprimorada aparecerá aqui.</p></div>}
          </div>
          {results.length > 1 && <div className="p-3 border-t border-slate-100 dark:border-slate-800 overflow-x-auto flex gap-2">{results.map((item) => <button key={item.id} onClick={() => setActiveId(item.id)} className={`w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 ${item.id === active?.id ? 'border-indigo-500' : 'border-transparent'}`} title={`${item.provider} · ${item.model}`}><img src={item.imageUrl} alt="" className="w-full h-full object-cover" /></button>)}</div>}
        </section>
      </div>
    </div>
  );
};