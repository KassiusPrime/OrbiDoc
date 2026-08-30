export type CapabilityLevel = 'open' | 'edit' | 'convert' | 'inspect' | 'planned';

export type FileCapabilityFamily = {
  id: string;
  label: string;
  description: string;
  extensions: string[];
  capabilities: CapabilityLevel[];
  note?: string;
};

export const FILE_CAPABILITY_FAMILIES: FileCapabilityFamily[] = [
  {
    id: 'documents',
    label: 'Documentos e apresentações',
    description: 'Documentos paginados, apresentações, e-books e formatos de texto estruturado.',
    extensions: ['pdf', 'docx', 'docm', 'dotx', 'pptx', 'pptm', 'ppsx', 'potx', 'epub', 'md', 'markdown', 'html', 'htm', 'xhtml', 'odt', 'odp', 'ott', 'otp', 'xps', 'oxps', 'rtf', 'doc', 'ppt'],
    capabilities: ['open', 'edit', 'convert'],
    note: 'PDF, DOCX, PPTX, EPUB, Markdown e HTML têm os caminhos mais completos hoje. OpenDocument, XPS e Office legado estão na camada de paridade em expansão.',
  },
  {
    id: 'spreadsheets',
    label: 'Planilhas e tabelas',
    description: 'Grades, fórmulas, CSV e formatos de planilha modernos e legados.',
    extensions: ['xlsx', 'xlsm', 'xltx', 'xls', 'csv', 'tsv', 'ods', 'ots'],
    capabilities: ['open', 'edit', 'convert'],
    note: 'XLSX/CSV são os caminhos principais; XLS usa compatibilidade da engine XLSX. ODS/OTS entram na próxima etapa de fidelidade.',
  },
  {
    id: 'images',
    label: 'Imagens',
    description: 'Visualização, edição, redimensionamento, aprimoramento e conversão local por ImageMagick/WASM.',
    extensions: ['jpg', 'jpeg', 'jpe', 'jfif', 'png', 'webp', 'avif', 'apng', 'gif', 'bmp', 'dib', 'svg', 'ico', 'cur', 'tif', 'tiff', 'heic', 'heif', 'hif', 'jxl', 'jp2', 'j2k', 'jpf', 'jpx', 'jpm', 'psd', 'psb', 'dds', 'tga', 'exr', 'hdr', 'ppm', 'pgm', 'pbm', 'pnm', 'pcx', 'qoi', 'xcf', 'sgi', 'ras', 'sun', 'xbm', 'xpm', 'wpg', 'dng', 'cr2', 'cr3', 'nef', 'arw', 'orf', 'rw2', 'raf', 'srw', 'pef', 'raw'],
    capabilities: ['open', 'edit', 'convert', 'inspect'],
    note: 'Formatos RAW permanecem entrada-only quando a reconstrução fiel do sensor não é possível.',
  },
  {
    id: 'audio',
    label: 'Áudio',
    description: 'Reprodução, transcrição e processamento local quando o codec do dispositivo permite.',
    extensions: ['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'opus', 'amr', 'mka'],
    capabilities: ['open', 'edit', 'inspect'],
  },
  {
    id: 'video',
    label: 'Vídeo',
    description: 'Reprodução e ferramentas locais de clipe com detecção de suporte do navegador/dispositivo.',
    extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', '3gp', 'flv'],
    capabilities: ['open', 'edit', 'inspect'],
    note: 'A disponibilidade real de codecs varia entre navegador, Android WebView e hardware.',
  },
  {
    id: 'code-data',
    label: 'Texto, código e dados',
    description: 'Texto e código abrem como conteúdo legível; JSON, XML, CSV e Markdown recebem tratamento estruturado.',
    extensions: ['txt', 'log', 'ini', 'cfg', 'conf', 'properties', 'env', 'diff', 'patch', 'json', 'xml', 'yaml', 'yml', 'toml', 'plist', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cc', 'cpp', 'h', 'hpp', 'cs', 'kt', 'kts', 'go', 'rs', 'swift', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'php', 'rb', 'dart', 'lua', 'scala', 'gradle', 'vue', 'svelte', 'proto', 'graphql', 'gql'],
    capabilities: ['open', 'convert'],
    note: 'O editor de código dedicado, árvore JSON e múltiplas codificações serão consolidados sobre este mesmo registro.',
  },
  {
    id: 'archives',
    label: 'Arquivos compactados e pacotes',
    description: 'Navegação por conteúdo, extração e criação de pacotes sem executar o que estiver dentro deles.',
    extensions: ['zip', 'jar', 'apk', 'cbz', 'xpi', 'whl', 'vsix', 'nupkg', 'ipa', '7z', 'rar', 'tar', 'gz', 'xz', 'bz2'],
    capabilities: ['open', 'inspect', 'convert'],
    note: 'ZIP está implementado hoje. 7z/RAR/TAR e wrappers exigem codecs/engines adicionais antes de serem anunciados como completos.',
  },
  {
    id: 'specialist',
    label: 'Formatos especializados',
    description: 'Bancos, fontes, certificados, calendários, contatos, e-mail e dados desconhecidos.',
    extensions: ['sqlite', 'sqlite3', 'db', 'db3', 'ttf', 'otf', 'ttc', 'otc', 'woff', 'ics', 'vcs', 'vcf', 'eml', 'pem', 'crt', 'cer', 'key', 'der', 'pfx'],
    capabilities: ['open', 'inspect', 'planned'],
    note: 'A paridade com viewers especializados (SQLite, fontes, certificados, calendário, contato e e-mail) está explicitamente mapeada para implementação incremental.',
  },
  {
    id: 'unknown',
    label: 'Formato desconhecido',
    description: 'Quando nenhuma família corresponde, o OrbiDoc tenta texto seguro e depois inspeção binária/hexadecimal.',
    extensions: ['*'],
    capabilities: ['open', 'inspect'],
  },
];

export const normalizeExtension = (value: string) => value.trim().toLowerCase().replace(/^\./, '');

export function findCapabilityFamily(extension: string) {
  const normalized = normalizeExtension(extension);
  return FILE_CAPABILITY_FAMILIES.find((family) => family.extensions.includes(normalized))
    || FILE_CAPABILITY_FAMILIES.find((family) => family.id === 'unknown')!;
}

export function allRegisteredExtensions() {
  return Array.from(new Set(FILE_CAPABILITY_FAMILIES.flatMap((family) => family.extensions).filter((extension) => extension !== '*'))).sort();
}
