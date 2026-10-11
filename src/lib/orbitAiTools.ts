import { ORBIT_EXTENSIONS, type OrbitExtensionId } from './orbitExtensions';

export type OrbitAiToolId =
  | 'nexus.summarize'
  | 'nexus.planWorkflow'
  | 'writer.insertText'
  | 'writer.applyStyle'
  | 'writer.rewriteSelection'
  | 'sheets.setRangeValues'
  | 'sheets.createChart'
  | 'sheets.explainFormula'
  | 'slides.createDeck'
  | 'slides.rewriteSlide'
  | 'slides.suggestLayout'
  | 'design.addLayer'
  | 'design.adjustImage'
  | 'design.generateLayout'
  | 'pdf.runOcr'
  | 'pdf.summarize'
  | 'pdf.extractTable'
  | 'media.transcribe'
  | 'media.convert';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface OrbitAiToolDefinition {
  id: OrbitAiToolId;
  extensionId: OrbitExtensionId;
  requiredPermission: string;
  description: string;
  validate: (input: unknown) => input is JsonObject;
}

export interface OrbitAiToolContext {
  /** Permissions granted for this invocation, not merely declared by the extension. */
  grantedPermissions: readonly string[];
  /** A host-owned handler performs the actual editor mutation or read. */
  handlers: Partial<Record<OrbitAiToolId, (input: JsonObject) => Promise<unknown> | unknown>>;
  /** Optional per-call abort signal for cancellation by the host. */
  signal?: AbortSignal;
}

export type OrbitAiToolResult =
  | { ok: true; toolId: OrbitAiToolId; data: unknown }
  | { ok: false; toolId: string; code: 'UNKNOWN_TOOL' | 'INVALID_ARGUMENTS' | 'PERMISSION_DENIED' | 'HANDLER_UNAVAILABLE' | 'ABORTED' | 'EXECUTION_FAILED'; message: string };

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (input: JsonObject, keys: readonly string[]) =>
  Object.keys(input).every((key) => keys.includes(key));

const stringField = (input: JsonObject, key: string, maxLength = 20_000) =>
  typeof input[key] === 'string' && input[key].trim().length > 0 && input[key].length <= maxLength;

const safeIdentifier = (value: JsonValue | undefined) =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);

const validators = {
  emptyOrText: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['text', 'language']) &&
    (input.text === undefined || stringField(input, 'text')) &&
    (input.language === undefined || (typeof input.language === 'string' && input.language.length <= 64)),
  insertText: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['text', 'position']) &&
    stringField(input, 'text') &&
    (input.position === undefined || (typeof input.position === 'number' && Number.isInteger(input.position) && input.position >= 0)),
  applyStyle: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['style', 'start', 'end']) &&
    typeof input.style === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(input.style) &&
    typeof input.start === 'number' && Number.isInteger(input.start) && typeof input.end === 'number' && Number.isInteger(input.end) &&
    Number(input.start) >= 0 && Number(input.end) >= Number(input.start),
  rewriteSelection: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['instruction', 'selection']) &&
    stringField(input, 'instruction', 2_000) && stringField(input, 'selection', 20_000),
  setRangeValues: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['sheetId', 'range', 'values']) &&
    safeIdentifier(input.sheetId) && typeof input.range === 'string' &&
    /^[A-Z]{1,3}[1-9][0-9]{0,6}(?::[A-Z]{1,3}[1-9][0-9]{0,6})?$/.test(input.range) &&
    Array.isArray(input.values) && input.values.length > 0 && input.values.length <= 10_000 &&
    input.values.every((row) => Array.isArray(row) && row.length <= 1_000 &&
      row.every((cell) => cell === null || ['string', 'number', 'boolean'].includes(typeof cell))),
  createChart: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['sheetId', 'range', 'chartType', 'title']) &&
    safeIdentifier(input.sheetId) && typeof input.range === 'string' &&
    /^[A-Z]{1,3}[1-9][0-9]{0,6}(?::[A-Z]{1,3}[1-9][0-9]{0,6})?$/.test(input.range) &&
    ['bar', 'line', 'pie', 'area', 'scatter'].includes(String(input.chartType)) &&
    (input.title === undefined || (typeof input.title === 'string' && input.title.length <= 200)),
  explainFormula: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['formula']) && stringField(input, 'formula', 4_000),
  createDeck: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['title', 'topic', 'slideCount']) &&
    stringField(input, 'title', 200) && stringField(input, 'topic', 4_000) &&
    (input.slideCount === undefined || (typeof input.slideCount === 'number' && Number.isInteger(input.slideCount) && input.slideCount >= 1 && input.slideCount <= 80)),
  rewriteSlide: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['slideId', 'instruction']) &&
    safeIdentifier(input.slideId) && stringField(input, 'instruction', 2_000),
  suggestLayout: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['slideId', 'content']) &&
    safeIdentifier(input.slideId) && stringField(input, 'content', 20_000),
  addLayer: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['name', 'kind']) &&
    stringField(input, 'name', 200) && ['text', 'shape', 'image', 'group'].includes(String(input.kind)),
  adjustImage: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['assetId', 'adjustments']) &&
    safeIdentifier(input.assetId) && isObject(input.adjustments) &&
    Object.keys(input.adjustments).length <= 12 &&
    Object.values(input.adjustments).every((v) => typeof v === 'number' && Number.isFinite(v) && v >= -100 && v <= 100),
  generateLayout: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['brief', 'aspectRatio']) &&
    stringField(input, 'brief', 4_000) &&
    (input.aspectRatio === undefined || ['1:1', '4:3', '16:9', '9:16', '3:2'].includes(String(input.aspectRatio))),
  runOcr: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['fileId', 'language']) &&
    safeIdentifier(input.fileId) && (input.language === undefined || (typeof input.language === 'string' && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(input.language))),
  extractTable: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['fileId', 'page']) &&
    safeIdentifier(input.fileId) && (input.page === undefined || (typeof input.page === 'number' && Number.isInteger(input.page) && input.page >= 1 && input.page <= 100_000)),
  transcribe: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['fileId', 'language']) &&
    safeIdentifier(input.fileId) && (input.language === undefined || (typeof input.language === 'string' && input.language.length <= 64)),
  convert: (input: unknown): input is JsonObject =>
    isObject(input) && hasOnlyKeys(input, ['fileId', 'targetFormat']) &&
    safeIdentifier(input.fileId) && typeof input.targetFormat === 'string' &&
    /^[a-z0-9][a-z0-9.+-]{0,31}$/.test(input.targetFormat),
} satisfies Record<string, (input: unknown) => input is JsonObject>;

const definition = (
  id: OrbitAiToolId,
  extensionId: OrbitExtensionId,
  requiredPermission: string,
  description: string,
  validate: (input: unknown) => input is JsonObject,
): OrbitAiToolDefinition => ({ id, extensionId, requiredPermission, description, validate });

export const ORBIT_AI_TOOLS: readonly OrbitAiToolDefinition[] = [
  definition('nexus.summarize', 'orbit.nexus', 'context.read.selected', 'Summarize user-selected content.', validators.emptyOrText),
  definition('nexus.planWorkflow', 'orbit.nexus', 'context.read.selected', 'Plan a workflow from an explicit user request.', validators.emptyOrText),
  definition('writer.insertText', 'orbit.writer', 'document.write.active', 'Insert text into the active document.', validators.insertText),
  definition('writer.applyStyle', 'orbit.writer', 'document.write.active', 'Apply a named style to an explicit text range.', validators.applyStyle),
  definition('writer.rewriteSelection', 'orbit.writer', 'document.read.active', 'Rewrite an explicit selection without mutating it.', validators.rewriteSelection),
  definition('sheets.setRangeValues', 'orbit.sheets', 'workbook.write.active', 'Set values in an explicit spreadsheet range.', validators.setRangeValues),
  definition('sheets.createChart', 'orbit.sheets', 'workbook.write.active', 'Create a chart from an explicit range.', validators.createChart),
  definition('sheets.explainFormula', 'orbit.sheets', 'workbook.read.active', 'Explain a formula without changing the workbook.', validators.explainFormula),
  definition('slides.createDeck', 'orbit.slides', 'deck.write.active', 'Create a presentation from a user-provided brief.', validators.createDeck),
  definition('slides.rewriteSlide', 'orbit.slides', 'deck.write.active', 'Rewrite the content of an explicit slide.', validators.rewriteSlide),
  definition('slides.suggestLayout', 'orbit.slides', 'deck.read.active', 'Suggest a layout for an explicit slide.', validators.suggestLayout),
  definition('design.addLayer', 'orbit.design', 'design.write.active', 'Add a layer to the active design.', validators.addLayer),
  definition('design.adjustImage', 'orbit.design', 'design.write.active', 'Adjust an explicitly selected image asset.', validators.adjustImage),
  definition('design.generateLayout', 'orbit.design', 'design.write.active', 'Generate a layout from an explicit brief.', validators.generateLayout),
  definition('pdf.runOcr', 'orbit.pdf', 'file.read.selected', 'Run OCR on a user-selected file.', validators.runOcr),
  definition('pdf.summarize', 'orbit.pdf', 'file.read.selected', 'Summarize text from a user-selected PDF.', validators.runOcr),
  definition('pdf.extractTable', 'orbit.pdf', 'file.read.selected', 'Extract a table from a user-selected PDF page.', validators.extractTable),
  definition('media.transcribe', 'orbit.media', 'file.read.selected', 'Transcribe a user-selected media file.', validators.transcribe),
  definition('media.convert', 'orbit.media', 'file.write.export', 'Convert a user-selected file to an explicit target format.', validators.convert),
] as const;

const toolById = new Map<string, OrbitAiToolDefinition>(ORBIT_AI_TOOLS.map((tool) => [tool.id, tool]));

export function validateOrbitAiToolCatalog(): string[] {
  const errors: string[] = [];
  const extensionIds = new Set(ORBIT_EXTENSIONS.map((extension) => extension.id));
  const ids = new Set<string>();
  for (const tool of ORBIT_AI_TOOLS) {
    if (ids.has(tool.id)) errors.push(`Duplicate tool ID: ${tool.id}`);
    ids.add(tool.id);
    if (!extensionIds.has(tool.extensionId)) errors.push(`Unknown extension for tool: ${tool.id}`);
    const extension = ORBIT_EXTENSIONS.find((item) => item.id === tool.extensionId);
    if (!extension?.aiTools.includes(tool.id)) errors.push(`Tool missing from extension manifest: ${tool.id}`);
    if (!extension?.permissions.includes(tool.requiredPermission)) errors.push(`Permission not declared by extension: ${tool.id} requires ${tool.requiredPermission}`);
  }
  for (const extension of ORBIT_EXTENSIONS) {
    for (const id of extension.aiTools) if (!ids.has(id)) errors.push(`Manifest tool has no definition: ${id}`);
  }
  return errors;
}

export async function dispatchOrbitAiTool(
  toolId: string,
  input: unknown,
  context: OrbitAiToolContext,
): Promise<OrbitAiToolResult> {
  const tool = toolById.get(toolId);
  if (!tool) return { ok: false, toolId, code: 'UNKNOWN_TOOL', message: 'Esta ferramenta não está registrada no Orbit.' };
  if (context.signal?.aborted) return { ok: false, toolId, code: 'ABORTED', message: 'A operação foi cancelada antes de iniciar.' };
  if (!tool.validate(input)) return { ok: false, toolId, code: 'INVALID_ARGUMENTS', message: 'Os argumentos não correspondem ao contrato da ferramenta.' };
  if (!context.grantedPermissions.includes(tool.requiredPermission)) {
    return { ok: false, toolId, code: 'PERMISSION_DENIED', message: 'A permissão necessária não foi concedida para esta chamada.' };
  }
  const handler = context.handlers[tool.id];
  if (!handler) return { ok: false, toolId, code: 'HANDLER_UNAVAILABLE', message: 'A ferramenta está registrada, mas o adaptador do editor ainda não foi conectado.' };
  try {
    const data = await handler(input);
    return { ok: true, toolId: tool.id, data };
  } catch {
    return { ok: false, toolId, code: 'EXECUTION_FAILED', message: 'A ferramenta falhou. Nenhum detalhe interno foi exposto.' };
  }
}
