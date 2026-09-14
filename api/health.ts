const FREE_MODEL_COUNT = 5;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    product: 'Orbit',
    workspace: 'Orbispace',
    office: 'OrbiDoc',
    ai: {
      assistant: 'Nexus AI',
      gateway: 'free-inference',
      configured: Boolean(String(process.env.OPENROUTER_API_KEY ?? '').trim()),
      freeOnly: true,
      healthyModels: FREE_MODEL_COUNT,
      totalModels: FREE_MODEL_COUNT,
    },
  });
}
