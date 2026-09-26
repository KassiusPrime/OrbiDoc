import type { TabType } from '../types';

export type OrbitModuleId = 'nova' | 'gravity' | 'aurora' | 'comet' | 'nebula' | 'satellite' | 'horizon' | 'pulsar' | 'meridian';

export type OrbitModuleDefinition = {
  id: OrbitModuleId;
  name: string;
  shortName: string;
  purpose: string;
  accent: string;
  tab?: TabType;
  priority: 'P1' | 'P2' | 'P3';
};

export const ORBIT_MODULES: Readonly<Record<OrbitModuleId, OrbitModuleDefinition>> = Object.freeze({
  nova: { id: 'nova', name: 'Documento', shortName: 'Documento', purpose: 'Documentos', accent: '#3157F6', tab: 'word', priority: 'P1' },
  gravity: { id: 'gravity', name: 'Planilha', shortName: 'Planilha', purpose: 'Planilhas', accent: '#059669', tab: 'excel', priority: 'P1' },
  aurora: { id: 'aurora', name: 'Apresentação', shortName: 'Apresentação', purpose: 'Apresentações', accent: '#C026D3', tab: 'powerpoint', priority: 'P1' },
  comet: { id: 'comet', name: 'Design', shortName: 'Design', purpose: 'Design', accent: '#EA580C', tab: 'canva', priority: 'P1' },
  nebula: { id: 'nebula', name: 'PDF & OCR', shortName: 'PDF & OCR', purpose: 'PDF & OCR', accent: '#0E7490', tab: 'extract', priority: 'P2' },
  satellite: { id: 'satellite', name: 'Arquivos', shortName: 'Arquivos', purpose: 'Arquivos & Nuvem', accent: '#64748B', tab: 'projects', priority: 'P2' },
  horizon: { id: 'horizon', name: 'Dashboards', shortName: 'Dashboards', purpose: 'Analytics & Dashboards', accent: '#1D4ED8', tab: 'analytics', priority: 'P2' },
  pulsar: { id: 'pulsar', name: 'Formulários', shortName: 'Formulários', purpose: 'Formulários & Automação', accent: '#D97706', priority: 'P3' },
  meridian: { id: 'meridian', name: 'Agenda', shortName: 'Agenda', purpose: 'Agenda & Calendário', accent: '#0891B2', priority: 'P3' },
});

export const ORBIT_MODULE_LIST: readonly OrbitModuleDefinition[] = Object.freeze(Object.values(ORBIT_MODULES));

export function orbitModuleForTab(tab: string): OrbitModuleDefinition | undefined {
  return ORBIT_MODULE_LIST.find((module) => module.tab === tab);
}

export function orbitProductTitle(tab: string): string {
  if (tab === 'home') return 'Orbispace';
  if (tab === 'chat' || tab === 'ai' || tab === 'compare') return 'Nexus AI';
  if (tab === 'office') return 'OrbiDoc';
  if (tab === 'cloud') return 'Conexões de nuvem';
  if (tab === 'image') return 'Imagens IA';
  if (tab === 'audio') return 'Áudio & Ditado';
  if (tab === 'history') return 'Histórico';
  return orbitModuleForTab(tab)?.name || 'Orbit';
}
