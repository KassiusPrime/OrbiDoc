import { compactError } from './_lib/ai.js';
import { editImageResilient } from './_lib/imageRuntime.js';

function parseBody(body: any) {
  if (typeof body !== 'string') return body || {};
  try { return JSON.parse(body); } catch { return {}; }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const result = await editImageResilient(parseBody(req.body));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(result);
  } catch (error) {
    res.status(502).json({ error: compactError(error) });
  }
}