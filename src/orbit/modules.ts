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

export const ORBIT_MODULES = Object.freeze({
  nova: { id: 'nova', name: 'Orbit Nova', shortName: 'Nova', purpose: 'Documentos', accent: '#3157F6', tab: 'word', priority: 'P1' },
  gravity: { id: 'gravity', name: 'Orbit Gravity', shortName: 'Gravity', purpose: 'Planilhas', accent: '#059669', tab: 'excel', priority: 'P1' },
  aurora: { id: 'aurora', name: 'Orbit Aurora', shortName: 'Aurora', purpose: 'Apresentações', accent: '#C026D3', tab: 'powerpoint', priority: 'P1' },
  comet: { id: 'comet', name: 'Orbit Comet', shortName: 'Comet', purpose: 'Design', accent: '#EA580C', tab: 'canva', priority: 'P1' },
  nebula: { id: 'nebula', name: 'Orbit Nebula', shortName: 'Nebula', purpose: 'PDF & OCR', accent: '#0E7490', tab: 'extract', priority: 'P2' },
  satellite: { id: 'satellite', name: 'Orbit Satellite', shortName: 'Satellite', purpose: 'Arquivos & Nuvem', accent: '#64748B', tab: 'projects', priority: 'P2' },
  horizon: { id: 'horizon', name: 'Orbit Horizon', shortName: 'Horizon', purpose: 'Analytics & Dashboards', accent: '#1D4ED8', tab: 'analytics', priority: 'P2' },
  pulsar: { id: 'pulsar', name: 'Orbit Pulsar', shortName: 'Pulsar', purpose: 'Formulários & Automação', accent: '#D97706', priority: 'P3' },
  meridian: { id: 'meridian', name: 'Orbit Meridian', shortName: 'Meridian', purpose: 'Agenda & Calendário', accent: '#0891B2', priority: 'P3' },
} satisfies Record<OrbitModuleId, OrbitModuleDefinition>);

export const ORBIT_MODULE_LIST = Object.freeze(Object.values(ORBIT_MODULES));

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
