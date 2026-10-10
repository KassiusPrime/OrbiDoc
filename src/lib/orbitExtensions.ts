import type { TabType } from '../types';

export type OrbitExtensionId =
  | 'orbit.nexus'
  | 'orbit.writer'
  | 'orbit.sheets'
  | 'orbit.slides'
  | 'orbit.design'
  | 'orbit.pdf'
  | 'orbit.media';

export type OrbitExtensionStage = 'core' | 'native-existing' | 'legacy-adapter' | 'planned';

export interface OrbitExtensionManifest {
  id: OrbitExtensionId;
  name: string;
  version: string;
  description: string;
  route: TabType;
  stage: OrbitExtensionStage;
  documentTypes: readonly string[];
  capabilities: readonly string[];
  aiTools: readonly string[];
  permissions: readonly string[];
  mobileSupport: 'full' | 'limited' | 'desktop';
}

/**
 * Static registry only: extensions are trusted, bundled code.
 * Do not turn this into remote code loading. Capabilities are declarative metadata
 * until a permission-aware command dispatcher is implemented.
 */
export const ORBIT_EXTENSIONS: readonly OrbitExtensionManifest[] = [
  {
    id: 'orbit.nexus',
    name: 'Nexus AI',
    version: '0.1.0',
    description: 'Núcleo de assistência, planejamento e orquestração de ferramentas.',
    route: 'chat',
    stage: 'core',
    documentTypes: [],
    capabilities: ['ai.chat', 'workflow.plan', 'tool.discover'],
    aiTools: ['nexus.summarize', 'nexus.planWorkflow'],
    permissions: ['context.read.selected'],
    mobileSupport: 'full',
  },
  {
    id: 'orbit.writer',
    name: 'Orbit Writer',
    version: '0.1.0',
    description: 'Editor próprio de documentos estruturados e compatibilidade DOCX.',
    route: 'word',
    stage: 'planned',
    documentTypes: ['orbit.writer', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    capabilities: ['document.read', 'document.edit', 'document.export.pdf', 'document.export.docx'],
    aiTools: ['writer.insertText', 'writer.applyStyle', 'writer.rewriteSelection'],
    permissions: ['document.read.active', 'document.write.active'],
    mobileSupport: 'limited',
  },
  {
    id: 'orbit.sheets',
    name: 'Orbit Sheets',
    version: '0.1.0',
    description: 'Editor próprio de workbooks, células, fórmulas e gráficos.',
    route: 'excel',
    stage: 'planned',
    documentTypes: ['orbit.sheets', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
    capabilities: ['workbook.read', 'workbook.edit', 'workbook.export.xlsx', 'workbook.export.csv'],
    aiTools: ['sheets.setRangeValues', 'sheets.createChart', 'sheets.explainFormula'],
    permissions: ['workbook.read.active', 'workbook.write.active'],
    mobileSupport: 'limited',
  },
  {
    id: 'orbit.slides',
    name: 'Orbit Slides',
    version: '0.1.0',
    description: 'Editor próprio de apresentações, layouts, objetos e notas.',
    route: 'powerpoint',
    stage: 'planned',
    documentTypes: ['orbit.slides', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    capabilities: ['deck.read', 'deck.edit', 'deck.export.pptx', 'deck.export.pdf'],
    aiTools: ['slides.createDeck', 'slides.rewriteSlide', 'slides.suggestLayout'],
    permissions: ['deck.read.active', 'deck.write.active'],
    mobileSupport: 'limited',
  },
  {
    id: 'orbit.design',
    name: 'Orbit Design',
    version: '0.1.0',
    description: 'Canvas próprio para composição visual e edição de imagem.',
    route: 'canva',
    stage: 'native-existing',
    documentTypes: ['orbit.design', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    capabilities: ['design.read', 'design.edit', 'design.layers', 'design.export'],
    aiTools: ['design.addLayer', 'design.adjustImage', 'design.generateLayout'],
    permissions: ['design.read.active', 'design.write.active'],
    mobileSupport: 'limited',
  },
  {
    id: 'orbit.pdf',
    name: 'Orbit PDF & Scan',
    version: '0.1.0',
    description: 'Renderização, OCR, anotação e operações explícitas em PDF.',
    route: 'extract',
    stage: 'native-existing',
    documentTypes: ['application/pdf', 'image/tiff', 'image/png', 'image/jpeg'],
    capabilities: ['pdf.read', 'pdf.ocr', 'pdf.annotate', 'pdf.export'],
    aiTools: ['pdf.runOcr', 'pdf.summarize', 'pdf.extractTable'],
    permissions: ['file.read.selected', 'file.write.export'],
    mobileSupport: 'full',
  },
  {
    id: 'orbit.media',
    name: 'Orbit Media',
    version: '0.1.0',
    description: 'Conversão de arquivos, imagem e áudio em tarefas independentes.',
    route: 'audio',
    stage: 'native-existing',
    documentTypes: ['audio/*', 'image/*', 'application/zip'],
    capabilities: ['media.convert', 'media.transcribe', 'media.synthesize'],
    aiTools: ['media.transcribe', 'media.convert'],
    permissions: ['file.read.selected', 'file.write.export', 'microphone.optional'],
    mobileSupport: 'limited',
  },
] as const;

export function getOrbitExtension(id: OrbitExtensionId): OrbitExtensionManifest | undefined {
  return ORBIT_EXTENSIONS.find((extension) => extension.id === id);
}

export function getOrbitExtensionForRoute(route: TabType): OrbitExtensionManifest | undefined {
  return ORBIT_EXTENSIONS.find((extension) => extension.route === route);
}
