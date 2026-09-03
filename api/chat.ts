import { nexusAI, type NexusBody } from './_lib/nexusAI.js';
import { applyNativeCors } from './_lib/nativeCors.js';

function parseBody(body: unknown): NexusBody {
  if (typeof body !== 'string') return (body ?? {}) as NexusBody;
  try {
    return JSON.parse(body) as NexusBody;
  } catch {
    return {};
  }
}

function compactError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error ?? 'Falha desconhecida'))
    .replace(/\s+/g, ' ')
    .slice(0, 420);
}

export default async function handler(req: any, res: any) {
  if (applyNativeCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const result = await nexusAI.complete(parseBody(req.body));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Orbit-Request-Id', result.requestId);
    res.status(200).json(result);
  } catch (error) {
    res.status(502).json({ error: compactError(error) });
  }
}
