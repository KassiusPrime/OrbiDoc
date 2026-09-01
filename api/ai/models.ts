import { NEXUS_FREE_MODELS, nexusAI } from '../_lib/nexusAI.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const status = nexusAI.status();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    assistant: 'Nexus AI',
    gateway: 'OpenRouter',
    unified: true,
    userSelectableModels: false,
    freeOnly: true,
    configured: status.configured,
    internalPoolSize: NEXUS_FREE_MODELS.length,
  });
}
