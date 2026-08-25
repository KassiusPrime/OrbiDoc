import React, { useMemo, useState } from 'react';
import { IconCopy as Copy, IconCrop as Crop, IconPhoto as Photo, IconPlus as Plus, IconRestore as Restore, IconTrash as Trash } from '@tabler/icons-react';
import type { SavedProject } from '../types';
import { addDesignPage, deleteDesignPage, ensureDesignPages, renameDesignPage, switchDesignPage, type MultiPageDesign } from '../lib/designPages';
import { cropRatioValue, transformDesignImage, type CropRatio, type DesignImageFilter, type DesignImageMask } from '../lib/designImageTools';

type Props = { project: SavedProject; onProjectChange: (project: SavedProject) => void; onApplied: () => void; showNotification?: (message: string, type?: 'success' | 'error') => void };

export const DesignAdvancedPanel: React.FC<Props> = ({ project, onProjectChange, onApplied, showNotification = () => {} }) => {
  const [open, setOpen] = useState(false);
  const [ratio, setRatio] = useState<CropRatio>('original');
  const [filter, setFilter] = useState<DesignImageFilter>('none');
  const [mask, setMask] = useState<DesignImageMask>('none');
  const [busy, setBusy] = useState(false);
  const design = project.content as MultiPageDesign;
  const normalized = useMemo(() => design?.elements ? ensureDesignPages(design) : design, [design]);
  const imageElements = useMemo(() => (design?.elements || []).filter((element: any) => element.type === 'image' && element.content), [design]);
  const [selectedImageId, setSelectedImageId] = useState<string>('');
  const selectedImage = imageElements.find((element: any) => element.id === selectedImageId) || imageElements[0];

  if (!design?.elements) return null;

  const persist = (nextDesign: MultiPageDesign, message: string) => {
    const updated = { ...project, content: nextDesign, title: String((nextDesign as any).title || project.title), updatedAt: new Date().toISOString() };
    try { localStorage.setItem(`orbidoc_design_v4_${project.id}`, JSON.stringify({ design: nextDesign, updatedAt: updated.updatedAt })); } catch { /* quota */ }
    onProjectChange(updated); onApplied(); showNotification(message, 'success');
  };

  const transformSelected = async () => {
    if (!selectedImage) { showNotification('Adicione ou selecione uma imagem primeiro.', 'error'); return; }
    setBusy(true);
    try {
      const result = await transformDesignImage(String(selectedImage.content), { ratio, filter, mask, quality: 0.94 });
      const source = design.elements.map((element: any) => {
        if (element.id !== selectedImage.id) return element;
        const original = element.orbiOriginalContent || element.content;
        const targetRatio = cropRatioValue(ratio, result.sourceWidth, result.sourceHeight);
        const nextHeight = ratio === 'original' ? element.height : Math.max(8, element.width / targetRatio);
        return { ...element, content: result.dataUrl, height: nextHeight, orbiOriginalContent: original, orbiImageEdit: { ratio, filter, mask } };
      });
      persist({ ...design, elements: source }, 'Edição local aplicada à imagem. O original foi preservado para restauração.');
    } catch (error: any) { showNotification(error?.message || 'Falha ao processar a imagem.', 'error'); }
    finally { setBusy(false); }
  };

  const restoreSelected = () => {
    if (!selectedImage) return;
    const source = design.elements.map((element: any) => {
      if (element.id !== selectedImage.id || !element.orbiOriginalContent) return element;
      const { orbiOriginalContent, orbiImageEdit, ...rest } = element;
      return { ...rest, content: orbiOriginalContent };
    });
    persist({ ...design, elements: source }, 'Imagem original restaurada.');
  };

  return <section className="mb-3 rounded-2xl border border-fuchsia-200/70 dark:border-fuchsia-900 bg-fuchsia-50/40 dark:bg-fuchsia-950/10 overflow-hidden">
    <button onClick={() => setOpen((value) => !value)} className="w-full min-h-11 px-3 sm:px-4 flex items-center gap-2 text-left"><Photo className="w-4 h-4 text-fuchsia-600" /><span className="text-xs font-black">Design Studio Pro</span><span className="text-[9px] text-slate-500 dark:text-slate-400">Páginas · crop · máscaras · filtros</span><span className="ml-auto text-[10px] font-black text-fuchsia-700 dark:text-fuchsia-300">{open ? 'Recolher' : 'Abrir'}</span></button>
    {open && <div className="p-3 sm:p-4 border-t border-fuchsia-200/60 dark:border-fuchsia-900 grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="text-[10px] font-black">Páginas do design</div><p className="mt-1 text-[8px] leading-relaxed text-slate-400">Cada página salva seu próprio canvas e elementos dentro do mesmo projeto.</p><div className="mt-2 flex flex-wrap gap-1.5">{(normalized.orbiPages || []).map((page) => <button key={page.id} onClick={() => persist(switchDesignPage(design, page.id), `${page.name} aberta.`)} className={`h-8 px-2 rounded-lg border text-[9px] font-black ${normalized.orbiActivePageId === page.id ? 'bg-fuchsia-600 text-white border-fuchsia-600' : ''}`}>{page.name}</button>)}</div><div className="mt-2 grid grid-cols-3 gap-2"><button onClick={() => persist(addDesignPage(design, false), 'Nova página criada.')} className="h-9 rounded-lg bg-fuchsia-600 text-white text-[9px] font-black inline-flex items-center justify-center gap-1"><Plus className="w-3.5 h-3.5" /> Nova</button><button onClick={() => persist(addDesignPage(design, true), 'Página duplicada.')} className="h-9 rounded-lg border text-[9px] font-black inline-flex items-center justify-center gap-1"><Copy className="w-3.5 h-3.5" /> Duplicar</button><button onClick={() => normalized.orbiActivePageId && persist(deleteDesignPage(design, normalized.orbiActivePageId), 'Página removida.')} disabled={(normalized.orbiPages?.length || 0) <= 1} className="h-9 rounded-lg border text-rose-600 text-[9px] font-black inline-flex items-center justify-center gap-1 disabled:opacity-40"><Trash className="w-3.5 h-3.5" /> Excluir</button></div><div className="mt-2 flex gap-2"><input id="orbidoc-page-name" defaultValue={(normalized.orbiPages || []).find((page) => page.id === normalized.orbiActivePageId)?.name || 'Página'} className="h-8 flex-1 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[9px]" /><button onClick={() => { const input = document.getElementById('orbidoc-page-name') as HTMLInputElement | null; if (normalized.orbiActivePageId && input) persist(renameDesignPage(design, normalized.orbiActivePageId, input.value), 'Página renomeada.'); }} className="h-8 px-2 rounded-lg border text-[9px] font-black">Renomear</button></div></div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Crop className="w-4 h-4 text-cyan-600" /> Laboratório de imagem</div>{imageElements.length ? <><select value={selectedImage?.id || ''} onChange={(event) => setSelectedImageId(event.target.value)} className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[9px]">{imageElements.map((element: any, index) => <option key={element.id} value={element.id}>Imagem {index + 1}</option>)}</select><div className="mt-2 grid grid-cols-3 gap-2"><select value={ratio} onChange={(event) => setRatio(event.target.value as CropRatio)} className="h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-1 text-[9px]"><option value="original">Original</option><option value="1:1">1:1</option><option value="4:5">4:5</option><option value="16:9">16:9</option><option value="9:16">9:16</option></select><select value={mask} onChange={(event) => setMask(event.target.value as DesignImageMask)} className="h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-1 text-[9px]"><option value="none">Sem máscara</option><option value="circle">Circular</option><option value="rounded">Arredondada</option></select><select value={filter} onChange={(event) => setFilter(event.target.value as DesignImageFilter)} className="h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-1 text-[9px]"><option value="none">Sem filtro</option><option value="grayscale">P&B</option><option value="sepia">Sépia</option><option value="contrast">Contraste</option><option value="bright">Brilho</option><option value="saturate">Saturação</option><option value="soft-blur">Blur suave</option></select></div><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => void transformSelected()} disabled={busy} className="h-9 rounded-lg bg-cyan-600 text-white text-[9px] font-black disabled:opacity-50">{busy ? 'Processando…' : 'Aplicar localmente'}</button><button onClick={restoreSelected} disabled={!(selectedImage as any)?.orbiOriginalContent} className="h-9 rounded-lg border text-[9px] font-black inline-flex items-center justify-center gap-1 disabled:opacity-40"><Restore className="w-3.5 h-3.5" /> Restaurar original</button></div><p className="mt-2 text-[8px] leading-relaxed text-slate-400">Crop central e filtros são processados no dispositivo. A imagem original fica anexada ao elemento até você restaurá-la.</p></> : <div className="mt-3 text-[9px] text-slate-500">Nenhuma imagem no canvas. Importe uma imagem no editor para liberar crop, máscara e filtros.</div>}</div>
    </div>}
  </section>;
};