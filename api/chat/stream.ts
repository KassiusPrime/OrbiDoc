import { nexusOrchestrator } from '../_lib/nexusOrchestrator.js';
import type { NexusBody } from '../_lib/nexusAI.js';
import type { NexusClientMeta } from '../_lib/nexusAI.js';
import { applyNativeCors } from '../_lib/nativeCors.js';

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

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const write = (payload: object) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  try {
    await nexusOrchestrator.stream(
      parseBody(req.body),
      (chunk) => write({ chunk }),
      (meta: NexusClientMeta) => write({ meta }),
    );
  } catch (error) {
    write({ error: compactError(error) });
  } finally {
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
