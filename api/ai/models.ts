const FREE_MODELS = [
  'openrouter/free',
  'nvidia/nemotron-3.5-lightning:free',
  'cohere/north-mini-code:free',
  'liquid/lfm-2.5-2.6b:free',
  'thinkingmachines/inkling-small:free',
] as const;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    assistant: 'Nexus AI',
    gateway: 'free-inference',
    unified: true,
    userSelectableModels: false,
    freeOnly: true,
    configured: Boolean(String(process.env.OPENROUTER_API_KEY ?? '').trim()),
    internalPoolSize: FREE_MODELS.length,
  });
}
