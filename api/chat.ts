import { compactError, runChat } from './_lib/ai.js';

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
    const result = await runChat(parseBody(req.body));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-DocSwiss-Request-Id', result.requestId);
    res.status(200).json(result);
  } catch (error) {
    res.status(502).json({ error: compactError(error) });
  }
}
