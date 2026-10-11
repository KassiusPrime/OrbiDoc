import type { SavedProject, SlideData } from '../types';
import type { JsonObject } from './orbitAiTools';
import type { OrbitAiToolId } from './orbitAiTools';

type OrbitEditorHandler = (input: JsonObject) => unknown | Promise<unknown>;

export interface OrbitEditorAdapterHost {
  getActiveProject: () => SavedProject | null;
  onProjectChange: (project: SavedProject) => void;
  now?: () => string;
}

type WorkbookCell = { value?: string | number; formula?: string; [key: string]: unknown };
type WorkbookSheet = {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: Record<string, WorkbookCell>;
  [key: string]: unknown;
};
type Workbook = { version: number; sheets: WorkbookSheet[]; activeSheetId?: string; [key: string]: unknown };

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function projectFor(host: OrbitEditorAdapterHost, expectedType: SavedProject['type']): SavedProject {
  const project = host.getActiveProject();
  if (!project) throw new Error('Nenhum projeto está aberto.');
  if (project.type !== expectedType) throw new Error(`A ferramenta exige um projeto do tipo ${expectedType}.`);
  return project;
}

function saveProject(host: OrbitEditorAdapterHost, project: SavedProject, content: unknown): SavedProject {
  const updated = { ...project, content, updatedAt: (host.now || (() => new Date().toISOString()))() };
  host.onProjectChange(updated);
  return updated;
}

function columnIndex(label: string): number {
  let index = 0;
  for (const char of label.toUpperCase()) index = index * 26 + char.charCodeAt(0) - 64;
  return index - 1;
}

function parseCellRef(value: string): { row: number; column: number } {
  const match = /^([A-Z]{1,3})([1-9][0-9]{0,6})$/i.exec(value);
  if (!match) throw new Error('Referência de célula inválida.');
  return { column: columnIndex(match[1]), row: Number(match[2]) - 1 };
}

function parseRange(value: string) {
  const [startRef, endRef = startRef] = value.split(':');
  const start = parseCellRef(startRef);
  const end = parseCellRef(endRef);
  if (end.row < start.row || end.column < start.column) throw new Error('O intervalo deve começar no canto superior esquerdo.');
  const rows = end.row - start.row + 1;
  const columns = end.column - start.column + 1;
  if (rows * columns > 10_000) throw new Error('O intervalo excede o limite de 10.000 células por operação.');
  return { start, rows, columns };
}

function cellName(row: number, column: number): string {
  let n = column + 1;
  let label = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }
  return `${label}${row + 1}`;
}

function asWorkbook(content: unknown): Workbook {
  if (!content || typeof content !== 'object') throw new Error('O conteúdo da planilha não tem um modelo compatível.');
  const candidate = content as Partial<Workbook>;
  if (!Array.isArray(candidate.sheets) || candidate.sheets.length === 0) throw new Error('A planilha não contém abas editáveis.');
  return candidate as Workbook;
}

function createSlides(title: string, topic: string, count: number): SlideData[] {
  const safeTopic = topic.trim();
  return Array.from({ length: count }, (_, index) => {
    const isTitle = index === 0;
    const isClosing = index === count - 1 && count > 2;
    return {
      id: `orbit-ai-slide-${index + 1}-${Math.random().toString(36).slice(2, 10)}`,
      title: isTitle ? title : isClosing ? 'Conclusão e próximos passos' : `Ponto ${index}`,
      subtitle: isTitle ? safeTopic.slice(0, 180) : undefined,
      bullets: isTitle ? [] : isClosing
        ? ['Principais conclusões', 'Próxima ação recomendada']
        : [`Contexto: ${safeTopic.slice(0, 140)}`, 'Desenvolver este ponto com evidências e exemplos'],
      bgGradient: '',
      layout: isTitle ? 'title' : 'content',
      notes: '',
      image: undefined,
      elements: [],
    } as SlideData;
  });
}

export function createOrbitEditorHandlers(host: OrbitEditorAdapterHost): Partial<Record<OrbitAiToolId, OrbitEditorHandler>> {
  return {
    'writer.insertText': (input) => {
      const project = projectFor(host, 'word');
      if (typeof input.text !== 'string' || !input.text.trim()) throw new Error('O texto a inserir é obrigatório.');
      if (input.position !== undefined) throw new Error('Inserção em posição de cursor ainda não está conectada; omita position para acrescentar um parágrafo.');
      if (typeof project.content !== 'string' && project.content != null) throw new Error('O formato de conteúdo do documento não é compatível com inserção segura.');
      const current = typeof project.content === 'string' ? project.content : '';
      const next = `${current}${current.trim() ? '\n' : ''}<p>${escapeHtml(input.text)}</p>`;
      const updated = saveProject(host, project, next);
      return { projectId: updated.id, appended: true, updatedAt: updated.updatedAt };
    },
    'sheets.setRangeValues': (input) => {
      const project = projectFor(host, 'excel');
      const workbook = asWorkbook(project.content);
      if (typeof input.sheetId !== 'string' || typeof input.range !== 'string' || !Array.isArray(input.values)) {
        throw new Error('A aba, o intervalo e a matriz de valores são obrigatórios.');
      }
      const sheet = workbook.sheets.find((candidate) => candidate.id === input.sheetId);
      if (!sheet) throw new Error('A aba solicitada não existe neste workbook.');
      const range = parseRange(input.range);
      const values = input.values as unknown[];
      if (values.length !== range.rows || values.some((row) => !Array.isArray(row) || row.length !== range.columns)) {
        throw new Error('As dimensões da matriz não correspondem ao intervalo selecionado.');
      }
      const cells = { ...sheet.cells };
      let changedCells = 0;
      values.forEach((row, rowOffset) => {
        (row as unknown[]).forEach((value, columnOffset) => {
          if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
            throw new Error('Somente texto, números, valores booleanos e células vazias podem ser escritos.');
          }
          const key = cellName(range.start.row + rowOffset, range.start.column + columnOffset);
          const previous = cells[key] || {};
          const { formula: _formula, ...rest } = previous;
          cells[key] = { ...rest, value: value === null ? '' : String(value) };
          changedCells += 1;
        });
      });
      const nextWorkbook = {
        ...workbook,
        sheets: workbook.sheets.map((candidate) => candidate.id === sheet.id ? { ...candidate, cells } : candidate),
      };
      const updated = saveProject(host, project, nextWorkbook);
      return { projectId: updated.id, sheetId: sheet.id, range: input.range, changedCells, updatedAt: updated.updatedAt };
    },
    'slides.createDeck': (input) => {
      const project = projectFor(host, 'powerpoint');
      if (typeof input.title !== 'string' || !input.title.trim() || typeof input.topic !== 'string' || !input.topic.trim()) {
        throw new Error('O título e o tema da apresentação são obrigatórios.');
      }
      const count = typeof input.slideCount === 'number' ? input.slideCount : 5;
      if (!Number.isInteger(count) || count < 1 || count > 80) throw new Error('A apresentação deve ter entre 1 e 80 slides.');
      const nextDeck = {
        version: 4,
        title: input.title.trim(),
        slides: createSlides(input.title.trim(), input.topic.trim(), count),
        theme: 'orbi',
        fontFamily: 'Inter, system-ui, sans-serif',
      };
      const updated = saveProject(host, project, nextDeck);
      return { projectId: updated.id, slideCount: nextDeck.slides.length, updatedAt: updated.updatedAt };
    },
  };
}
