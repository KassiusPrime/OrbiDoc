import type { StudioElement } from './officeStudio';

export type DesignLike = { width: number; height: number; background: string; elements: StudioElement[]; [key: string]: unknown };

const hexRgb = (value: string) => {
  const raw = value.trim().replace('#', '');
  const hex = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
};
const luminance = (color: string) => {
  const rgb = hexRgb(color); if (!rgb) return null;
  const values = [rgb.r, rgb.g, rgb.b].map((channel) => { const c = channel / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
};
export const contrastRatio = (a: string, b: string) => { const la = luminance(a); const lb = luminance(b); if (la === null || lb === null) return null; const high = Math.max(la, lb); const low = Math.min(la, lb); return (high + 0.05) / (low + 0.05); };

export function resizeComposition(design: DesignLike, targetWidth: number, targetHeight: number) {
  const width = Math.max(64, Math.round(targetWidth)); const height = Math.max(64, Math.round(targetHeight));
  const scale = Math.min(width / Math.max(1, design.width), height / Math.max(1, design.height));
  const offsetX = (width - design.width * scale) / 2; const offsetY = (height - design.height * scale) / 2;
  return { ...design, width, height, elements: design.elements.map((element) => ({ ...element, x: offsetX + element.x * scale, y: offsetY + element.y * scale, width: Math.max(1, element.width * scale), height: Math.max(1, element.height * scale), fontSize: Math.max(8, element.fontSize * scale), strokeWidth: Math.max(0, element.strokeWidth * scale) })) };
}

export function clampDesignElements(design: DesignLike) {
  let changed = 0;
  const elements = design.elements.map((element) => {
    const width = Math.min(Math.max(8, element.width), design.width);
    const height = Math.min(Math.max(8, element.height), design.height);
    const x = Math.max(0, Math.min(design.width - width, element.x));
    const y = Math.max(0, Math.min(design.height - height, element.y));
    if (x !== element.x || y !== element.y || width !== element.width || height !== element.height) changed += 1;
    return { ...element, x, y, width, height };
  });
  return { design: { ...design, elements }, changed };
}

export function auditDesign(design: DesignLike) {
  const findings: Array<{ id: string; level: 'warning' | 'info'; message: string }> = [];
  design.elements.forEach((element, index) => {
    const label = element.type === 'text' ? String(element.content || '').trim().slice(0, 28) || `Texto ${index + 1}` : `${element.type} ${index + 1}`;
    if (element.x < 0 || element.y < 0 || element.x + element.width > design.width || element.y + element.height > design.height) findings.push({ id: element.id, level: 'warning', message: `${label}: parte do elemento está fora da área.` });
    if (element.type === 'text') {
      if (element.fontSize < 16) findings.push({ id: element.id, level: 'info', message: `${label}: texto pequeno (${Math.round(element.fontSize)} px).` });
      const ratio = contrastRatio(element.fill, design.background);
      const required = element.fontSize >= 24 || element.fontWeight >= 700 && element.fontSize >= 19 ? 3 : 4.5;
      if (ratio !== null && ratio < required) findings.push({ id: element.id, level: 'warning', message: `${label}: contraste ${ratio.toFixed(2)}:1 abaixo de ${required}:1.` });
    }
    if (element.opacity < 0.25) findings.push({ id: element.id, level: 'info', message: `${label}: opacidade muito baixa (${Math.round(element.opacity * 100)}%).` });
  });
  return { findings, warnings: findings.filter((item) => item.level === 'warning').length, info: findings.filter((item) => item.level === 'info').length };
}
