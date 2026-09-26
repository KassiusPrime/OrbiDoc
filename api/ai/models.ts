import { listModels } from '../_lib/ollamaNexus.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  const models = await listModels();
  res.status(200).json({
    assistant: 'Nexus AI',
    gateway: 'Ollama (self-hosted)',
    unified: true,
    userSelectableModels: true,
    freeOnly: true,
    models,
  });
}
