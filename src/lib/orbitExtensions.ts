import type { TabType } from '../types';

export type OrbitExtensionId =
  | 'orbit.nexus'
  | 'orbit.reader'
  | 'orbit.player'
  | 'orbit.image'
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
    id: 'orbit.reader',
    name: 'Orbit Reader',
    version: '1.0.0',
    description: 'Leitor somente leitura para documentos e arquivos selecionados pelo usuário.',
    route: 'reader',
    stage: 'native-existing',
    documentTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/epub+zip', 'text/plain', 'text/markdown', 'text/html', 'application/zip', 'image/*'],
    capabilities: ['document.read', 'document.search', 'archive.preview', 'document.open.local'],
    aiTools: [],
    permissions: ['file.read.selected'],
    mobileSupport: 'limited',
  },
  {
    id: 'orbit.player',
    name: 'Orbit Player',
    version: '1.0.0',
    description: 'Reprodutor original com UI web e motor LibVLC nativo no Android para arquivos locais e URLs HTTPS diretas; navegador usa codecs disponíveis no WebView.',
    route: 'player',
    stage: 'native-existing',
    documentTypes: ['audio/*', 'video/*', 'text/vtt', 'application/x-subrip'],
    capabilities: ['media.play.local', 'media.play.url', 'media.playlist', 'media.subtitle.selected', 'media.resume', 'media.seek', 'media.native.libvlc.android', 'media.codec.native.optional'],
    aiTools: [],
    permissions: ['file.read.selected', 'media.network.optional', 'subtitle.read.selected'],
    mobileSupport: 'limited',
  },
  {
    id: 'orbit.image',
    name: 'Orbit Image Studio',
    version: '1.0.0',
    description: 'Geração remota sujeita a configuração segura, edição por instrução e aprimoramento local de imagens.',
    route: 'image',
    stage: 'native-existing',
    documentTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
    capabilities: ['image.generate', 'image.edit', 'image.enhance.local', 'image.enhance.remote.optional', 'image.export'],
    aiTools: [],
    permissions: ['image.read.selected', 'image.remote.generate.optional', 'image.write.export'],
    mobileSupport: 'limited',
  },
  {
    id: 'orbit.writer',
    name: 'Orbit Writer',
    version: '0.1.0',
    description: 'Adaptador legado somente para visualizar projetos e arquivos DOCX existentes; edição desativada no Orbit.',
    route: 'word',
    stage: 'legacy-adapter',
    documentTypes: ['orbit.writer', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    capabilities: ['document.read'],
    aiTools: [],
    permissions: ['document.read.active'],
    mobileSupport: 'limited',
  },
  {
    id: 'orbit.sheets',
    name: 'Orbit Sheets',
    version: '0.1.0',
    description: 'Adaptador legado somente para visualizar projetos e arquivos XLSX/CSV existentes; edição desativada no Orbit.',
    route: 'excel',
    stage: 'legacy-adapter',
    documentTypes: ['orbit.sheets', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
    capabilities: ['workbook.read'],
    aiTools: [],
    permissions: ['workbook.read.active'],
    mobileSupport: 'limited',
  },
  {
    id: 'orbit.slides',
    name: 'Orbit Slides',
    version: '0.1.0',
    description: 'Adaptador legado somente para visualizar apresentações existentes; edição/exportação do deck desativada no Orbit.',
    route: 'powerpoint',
    stage: 'legacy-adapter',
    documentTypes: ['orbit.slides', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    capabilities: ['deck.read'],
    aiTools: [],
    permissions: ['deck.read.active'],
    mobileSupport: 'limited',
  },
  {
    id: 'orbit.design',
    name: 'Orbit Design',
    version: '0.1.0',
    description: 'Adaptador legado para visualizar metadados de designs existentes; o canvas de edição não é apresentado como app principal.',
    route: 'canva',
    stage: 'legacy-adapter',
    documentTypes: ['orbit.design', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    capabilities: ['design.read'],
    aiTools: [],
    permissions: ['design.read.active'],
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
    capabilities: ['pdf.read', 'pdf.ocr', 'pdf.extract.text'],
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
