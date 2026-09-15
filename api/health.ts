import { status as nexusStatus } from './_lib/nexusFreeAI.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }
  const status = nexusStatus();
  const healthyModels = status.circuits.filter((circuit) => circuit.failures < 3).length;
  const unavailableModels = status.circuits.filter((circuit) => circuit.failures >= 3).length;
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    product: 'Orbit',
    workspace: 'Orbispace',
    office: 'OrbiDoc',
    ai: {
      assistant: status.assistant,
      gateway: status.gateway,
      configured: status.configured,
      freeOnly: status.freeOnly,
      healthyModels,
      unavailableModels,
      totalModels: status.circuits.length,
    },
  });
}