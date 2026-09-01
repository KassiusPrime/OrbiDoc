import { nexusAI } from '../_lib/nexusAI.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const status = nexusAI.status();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    assistant: status.assistant,
    gateway: status.gateway,
    configured: status.configured,
    freeOnly: status.freeOnly,
    healthyModels: status.circuits.filter((circuit) => circuit.state !== 'OPEN').length,
    unavailableModels: status.circuits.filter((circuit) => circuit.state === 'OPEN').length,
    totalModels: status.circuits.length,
  });
}
