import { probeRemoteMedia } from '../_lib/remoteMedia.js';

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
    const body = parseBody(req.body);
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url || url.length > 4_000) throw new Error('Informe um link direto válido.');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(await probeRemoteMedia(url));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao analisar o link.' });
  }
}
