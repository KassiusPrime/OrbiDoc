export type StudioShape = 'rectangle' | 'rounded' | 'circle' | 'triangle' | 'diamond' | 'arrow' | 'star' | 'line';

export type StudioElement = {
  id: string;
  type: 'text' | 'shape' | 'image';
  shape?: StudioShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textAlign: 'left' | 'center' | 'right';
  locked?: boolean;
};

export type AlignmentGuides = { vertical: number[]; horizontal: number[] };

export const OFFICE_FONTS = [
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Sistema', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Aptos', value: 'Aptos, "Segoe UI", sans-serif' },
  { label: 'Calibri', value: 'Calibri, "Segoe UI", sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Arial, sans-serif' },
  { label: 'Century Gothic', value: '"Century Gothic", Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Garamond', value: 'Garamond, Georgia, serif' },
  { label: 'Palatino', value: '"Palatino Linotype", Palatino, serif' },
  { label: 'Cambria', value: 'Cambria, Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Lucida Console', value: '"Lucida Console", Monaco, monospace' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, sans-serif' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
] as const;

export const SHAPE_LIBRARY: Array<{ type: StudioShape; label: string }> = [
  { type: 'rectangle', label: 'Retângulo' },
  { type: 'rounded', label: 'Arredondado' },
  { type: 'circle', label: 'Círculo' },
  { type: 'triangle', label: 'Triângulo' },
  { type: 'diamond', label: 'Losango' },
  { type: 'arrow', label: 'Seta' },
  { type: 'star', label: 'Estrela' },
  { type: 'line', label: 'Linha' },
];

export const createStudioElement = (
  type: StudioElement['type'],
  canvasWidth: number,
  canvasHeight: number,
  patch: Partial<StudioElement> = {},
): StudioElement => ({
  id: crypto.randomUUID(),
  type,
  shape: type === 'shape' ? 'rectangle' : undefined,
  x: Math.round(canvasWidth * 0.2),
  y: Math.round(canvasHeight * 0.2),
  width: type === 'text' ? Math.round(canvasWidth * 0.5) : Math.round(canvasWidth * 0.3),
  height: type === 'text' ? Math.round(canvasHeight * 0.14) : Math.round(canvasHeight * 0.25),
  rotation: 0,
  opacity: 1,
  fill: type === 'text' ? '#0B1220' : '#3157F6',
  stroke: 'transparent',
  strokeWidth: 0,
  content: type === 'text' ? 'Novo texto' : '',
  fontSize: Math.max(18, Math.round(canvasWidth * 0.042)),
  fontFamily: OFFICE_FONTS[0].value,
  fontWeight: 700,
  textAlign: 'left',
  ...patch,
});

export const readImageAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('Falha ao ler a imagem.'));
  reader.readAsDataURL(file);
});

export const clampStudioPosition = (element: Pick<StudioElement, 'width' | 'height'>, x: number, y: number, canvasWidth: number, canvasHeight: number) => ({
  x: Math.max(-element.width + 16, Math.min(canvasWidth - 16, x)),
  y: Math.max(-element.height + 16, Math.min(canvasHeight - 16, y)),
});

const anchors = (start: number, size: number) => [start, start + size / 2, start + size];

const bestSnap = (moving: number[], targets: number[], threshold: number) => {
  let delta = 0;
  let target: number | null = null;
  let distance = threshold + 1;
  for (const movingPoint of moving) {
    for (const targetPoint of targets) {
      const candidate = targetPoint - movingPoint;
      const absolute = Math.abs(candidate);
      if (absolute <= threshold && absolute < distance) {
        distance = absolute;
        delta = candidate;
        target = targetPoint;
      }
    }
  }
  return { delta, target };
};

export const snapStudioElement = (
  element: StudioElement,
  desiredX: number,
  desiredY: number,
  others: StudioElement[],
  canvasWidth: number,
  canvasHeight: number,
  threshold = 8,
): { x: number; y: number; guides: AlignmentGuides } => {
  const xTargets = [0, canvasWidth / 2, canvasWidth];
  const yTargets = [0, canvasHeight / 2, canvasHeight];

  for (const other of others) {
    if (other.id === element.id) continue;
    xTargets.push(other.x, other.x + other.width / 2, other.x + other.width);
    yTargets.push(other.y, other.y + other.height / 2, other.y + other.height);
  }

  const xSnap = bestSnap(anchors(desiredX, element.width), xTargets, threshold);
  const ySnap = bestSnap(anchors(desiredY, element.height), yTargets, threshold);
  const clamped = clampStudioPosition(element, desiredX + xSnap.delta, desiredY + ySnap.delta, canvasWidth, canvasHeight);

  return {
    x: clamped.x,
    y: clamped.y,
    guides: {
      vertical: xSnap.target == null ? [] : [xSnap.target],
      horizontal: ySnap.target == null ? [] : [ySnap.target],
    },
  };
};

export const shapeClipPath = (shape: StudioShape) => {
  if (shape === 'triangle') return 'polygon(50% 0%, 100% 100%, 0% 100%)';
  if (shape === 'diamond') return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  if (shape === 'arrow') return 'polygon(0 30%, 65% 30%, 65% 0, 100% 50%, 65% 100%, 65% 70%, 0 70%)';
  if (shape === 'star') return 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 92%, 50% 71%, 21% 92%, 32% 57%, 2% 35%, 39% 35%)';
  return undefined;
};
