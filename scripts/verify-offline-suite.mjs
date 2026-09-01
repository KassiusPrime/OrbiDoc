import fs from 'node:fs/promises';

const read = (path) => fs.readFile(path, 'utf8');
const [
  pkg,
  vite,
  db,
  persistence,
  fileAccess,
  main,
  systemOpen,
  professionalRouter,
  documentWrapper,
  documentEditor,
  spreadsheetWrapper,
  spreadsheetEditor,
  fortune,
  pdfStudio,
  drive,
  cloud,
] = await Promise.all([
  read('package.json'),
  read('vite.config.ts'),
  read('src/db/orbidocDb.ts'),
  read('src/services/offlinePersistence.ts'),
  read('src/lib/fileSystemAccess.ts'),
  read('src/main.tsx'),
  read('src/components/SystemFileOpenAgent.tsx'),
  read('src/components/ProfessionalFileRouterAgent.tsx'),
  read('src/components/DocumentEditor.tsx'),
  read('src/components/DocumentEditorLexical.tsx'),
  read('src/components/SpreadsheetEditor.tsx'),
  read('src/components/SpreadsheetEditorFortune.tsx'),
  read('src/lib/fortuneSpreadsheet.ts'),
  read('src/components/PdfStudio.tsx'),
  read('src/services/driveSyncQueue.ts'),
  read('src/components/CloudWorkspace.tsx'),
]);

const assertions = [
  [pkg.includes('"lexical"') && pkg.includes('"@lexical/react"'), 'Lexical não está declarado como engine do editor de documentos.'],
  [pkg.includes('"@fortune-sheet/react"'), 'FortuneSheet não está declarado como engine da planilha.'],
  [pkg.includes('"dexie"') && pkg.includes('"dexie-react-hooks"'), 'Dexie não está declarado para persistência IndexedDB.'],
  [pkg.includes('"pdf-lib"') && pkg.includes('"pdfjs-dist"'), 'PDF.js/pdf-lib não estão declarados juntos.'],

  [vite.includes('handler: "CacheFirst"') && vite.includes('orbidoc-static-runtime'), 'Assets estáticos não possuem Cache-First explícito.'],
  [vite.includes('handler: "StaleWhileRevalidate"') && vite.includes('orbidoc-navigation'), 'Navegação não possui Stale-While-Revalidate explícito.'],
  [vite.includes('file_handlers') && vite.includes('application/pdf') && vite.includes('.docx') && vite.includes('.xlsx') && vite.includes('.md'), 'Manifest PWA perdeu os file_handlers obrigatórios.'],
  [vite.includes('**/*.{js,mjs,css,html,json'), 'Precache não inclui bundles, HTML e JSON do workspace.'],

  [db.includes("documents: 'id, updatedAt, driveFileId, isSynced, syncState'") || db.includes('documents:'), 'Tabela documents do Dexie não foi encontrada.'],
  [db.includes('sheets:') && db.includes('pdf_store:') && db.includes('sync_queue:'), 'Tabelas obrigatórias sheets/pdf_store/sync_queue não foram encontradas.'],
  [db.includes('assets:'), 'Tabela assets para blobs locais não foi encontrada.'],
  [persistence.includes('OFFLINE_AUTOSAVE_DELAY_MS = 800'), 'Autosave local não está configurado em 800 ms.'],
  [persistence.includes('modified-offline') && persistence.includes('conflict'), 'Estados de sincronização offline/conflito não estão presentes.'],

  [fileAccess.includes('showOpenFilePicker') && fileAccess.includes('showSaveFilePicker'), 'File System Access API não está implementada para abrir/salvar.'],
  [fileAccess.includes('createWritable') && fileAccess.includes('existingHandle'), 'Sobrescrita direta do arquivo local não está implementada.'],

  [main.includes('ProfessionalFileRouterAgent') && main.includes('installDriveSyncQueueAgent'), 'Roteador profissional ou agente de sincronização não está montado globalmente.'],
  [systemOpen.includes('window.launchQueue') && systemOpen.includes('dispatchProfessionalFile'), 'launchQueue não encaminha arquivos Office/PDF ao roteador profissional.'],
  [professionalRouter.includes("['docx', 'xlsx', 'xls', 'ods', 'csv', 'tsv', 'pdf']") || professionalRouter.includes("'docx', 'xlsx'"), 'Roteador profissional não cobre DOCX/XLSX/CSV/PDF.'],

  [documentWrapper.includes('DocumentEditorLexical') && !documentWrapper.includes('DocumentEditorStudio'), 'Editor de documentos ativo não está roteado exclusivamente ao Lexical.'],
  [documentWrapper.includes('DocumentFindReplaceBar'), 'Localizar/substituir deixou de fazer parte do editor ativo.'],
  [documentEditor.includes('<LexicalComposer') && documentEditor.includes('<HistoryPlugin') && documentEditor.includes('<TablePlugin'), 'Plugins essenciais Lexical não estão ativos.'],
  [documentEditor.includes('<CheckListPlugin') && documentEditor.includes('OrbiDocImageNode'), 'Checklist/imagens IndexedDB não estão integrados ao Lexical.'],
  [!documentEditor.includes('document.execCommand'), 'Editor Lexical ativo voltou a depender de document.execCommand.'],
  [documentEditor.includes('exportRichHtmlToDocx') && documentEditor.includes("import('mammoth')"), 'Importação DOCX/Exportação DOCX local do editor estão ausentes.'],
  [documentEditor.includes("queueGoogleDriveEntitySync('document'"), 'Autosave de documentos do Drive não entra na fila de sincronização.'],

  [spreadsheetWrapper.includes('SpreadsheetEditorFortune') && !spreadsheetWrapper.includes('SpreadsheetEditorStudio'), 'Planilha ativa não está roteada exclusivamente ao FortuneSheet.'],
  [spreadsheetEditor.includes('<Workbook') && spreadsheetEditor.includes('fortuneSheetsToXlsxBlob'), 'FortuneSheet/SheetJS não estão integrados na planilha ativa.'],
  [spreadsheetEditor.includes('showSheetTabs') && spreadsheetEditor.includes("'freeze'") && spreadsheetEditor.includes("'filter'"), 'Abas, congelamento ou filtros não estão habilitados.'],
  [fortune.includes('SOMA') && fortune.includes('AVERAGE') && fortune.includes('VLOOKUP') && fortune.includes('COUNTIF'), 'Aliases de fórmulas PT-BR/EN estão incompletos.'],
  [spreadsheetEditor.includes("queueGoogleDriveEntitySync('sheet'"), 'Autosave de planilhas do Drive não entra na fila de sincronização.'],

  [pdfStudio.includes("import('pdfjs-dist')") && pdfStudio.includes('TextLayer'), 'PDF.js com camada de texto não está implementado.'],
  [pdfStudio.includes('PDFDocument') && pdfStudio.includes('copyPages') && pdfStudio.includes('removePage') && pdfStudio.includes('setRotation'), 'Manipulação local de páginas via pdf-lib está incompleta.'],
  [pdfStudio.includes("type: 'highlight'") && pdfStudio.includes("type: 'underline'") && pdfStudio.includes("type: 'text'"), 'Anotações de PDF não cobrem realce/sublinhado/texto.'],
  [pdfStudio.includes("queueGoogleDriveEntitySync('pdf'"), 'Autosave de PDF do Drive não entra na fila de sincronização.'],

  [drive.includes('expectedDriveVersion') && drive.includes("syncState: 'conflict'") || drive.includes("markEntitySyncState(item.entityType, item.entityId, 'conflict'"), 'Fila Drive não possui proteção de conflito por versão.'],
  [drive.includes('queueGoogleDriveEntitySync') && drive.includes("window.addEventListener('online'"), 'Fila Drive não sincroniza entidades editadas ao reconectar.'],
  [cloud.includes('downloadGoogleDriveFileBlob') && cloud.includes('dispatchProfessionalFile'), 'Arquivos editáveis do Google Drive não são roteados aos editores profissionais.'],
];

const failures = assertions.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  throw new Error(`Offline productivity suite verification failed:\n- ${failures.join('\n- ')}`);
}

console.log('Offline productivity suite verification OK: PWA cache, Dexie persistence, File System Access, professional editors, launchQueue and Drive conflict-safe sync are wired.');
