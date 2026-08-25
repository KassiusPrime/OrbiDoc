import type { DesignLike } from './designPro';

export type DesignPage = { id: string; name: string; width: number; height: number; background: string; elements: any[] };
export type MultiPageDesign = DesignLike & { orbiPages?: DesignPage[]; orbiActivePageId?: string; [key: string]: unknown };

const snapshot = (design: MultiPageDesign, id?: string, name?: string): DesignPage => ({
  id: id || crypto.randomUUID(),
  name: name || `Página ${(design.orbiPages?.length || 0) + 1}`,
  width: design.width,
  height: design.height,
  background: design.background,
  elements: JSON.parse(JSON.stringify(design.elements || [])),
});

export function ensureDesignPages(design: MultiPageDesign): MultiPageDesign {
  if (design.orbiPages?.length && design.orbiActivePageId) return design;
  const page = snapshot(design, crypto.randomUUID(), 'Página 1');
  return { ...design, orbiPages: [page], orbiActivePageId: page.id };
}

const saveCurrent = (design: MultiPageDesign) => {
  const current = ensureDesignPages(design);
  return {
    ...current,
    orbiPages: current.orbiPages!.map((page) => page.id === current.orbiActivePageId ? snapshot(current, page.id, page.name) : page),
  };
};

export function addDesignPage(design: MultiPageDesign, duplicateCurrent = false) {
  const saved = saveCurrent(design);
  const page = duplicateCurrent
    ? snapshot(saved, crypto.randomUUID(), `Página ${saved.orbiPages!.length + 1}`)
    : { id: crypto.randomUUID(), name: `Página ${saved.orbiPages!.length + 1}`, width: saved.width, height: saved.height, background: saved.background, elements: [] };
  return { ...saved, width: page.width, height: page.height, background: page.background, elements: JSON.parse(JSON.stringify(page.elements)), orbiPages: [...saved.orbiPages!, page], orbiActivePageId: page.id };
}

export function switchDesignPage(design: MultiPageDesign, pageId: string) {
  const saved = saveCurrent(design);
  const target = saved.orbiPages!.find((page) => page.id === pageId);
  if (!target) return saved;
  return { ...saved, width: target.width, height: target.height, background: target.background, elements: JSON.parse(JSON.stringify(target.elements)), orbiActivePageId: target.id };
}

export function deleteDesignPage(design: MultiPageDesign, pageId: string) {
  const saved = saveCurrent(design);
  if (saved.orbiPages!.length <= 1) return saved;
  const pages = saved.orbiPages!.filter((page) => page.id !== pageId);
  const activeId = saved.orbiActivePageId === pageId ? pages[0].id : saved.orbiActivePageId!;
  const target = pages.find((page) => page.id === activeId) || pages[0];
  return { ...saved, width: target.width, height: target.height, background: target.background, elements: JSON.parse(JSON.stringify(target.elements)), orbiPages: pages, orbiActivePageId: target.id };
}

export function renameDesignPage(design: MultiPageDesign, pageId: string, name: string) {
  const saved = saveCurrent(design);
  const normalized = name.trim().slice(0, 40) || 'Página';
  return { ...saved, orbiPages: saved.orbiPages!.map((page) => page.id === pageId ? { ...page, name: normalized } : page) };
}
