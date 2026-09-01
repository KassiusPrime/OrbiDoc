import { generateImageResilient } from './_lib/imageRuntime.js';

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') return body || {};
  try { return JSON.parse(body) as unknown; } catch { return {}; }
}

function compactError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? 'Falha desconhecida')).replace(/\s+/g, ' ').slice(0, 420);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }
  try {
    const result = await generateImageResilient(parseBody(req.body));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(result);
  } catch (error) {
    res.status(503).json({ error: compactError(error) });
  }
}
