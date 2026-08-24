import { compactError } from '../_lib/ai.js';
import { streamChatSafely } from '../_lib/aiSafeStream.js';
import { hydrateGatewayRuntimeAuth } from '../_lib/gatewayAuth.js';
import { streamWebGroundedChat } from '../_lib/webGrounding.js';

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

  await hydrateGatewayRuntimeAuth();
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const write = (payload: object) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  try {
    const body = parseBody(req.body);
    if (body?.webSearch === true) await streamWebGroundedChat(body, write);
    else await streamChatSafely(body, write);
  } catch (error) {
    write({ error: compactError(error) });
  } finally {
    res.write('data: [DONE]\n\n');
    res.end();
  }
}