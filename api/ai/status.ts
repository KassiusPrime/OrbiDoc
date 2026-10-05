import { status as nexusStatus } from '../_lib/ollamaNexus.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const status = await nexusStatus();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    assistant: status.assistant,
    gateway: status.gateway,
    configured: status.configured,
    freeOnly: status.freeOnly,
    healthyModels: status.circuits.filter((circuit) => circuit.failures < 3).length,
    unavailableModels: status.circuits.filter((circuit) => circuit.failures >= 3).length,
    totalModels: status.circuits.length,
    ollama: status.ollama,
    model: status.model,
    modelPresent: status.modelPresent,
    search: status.search,
  });
}
