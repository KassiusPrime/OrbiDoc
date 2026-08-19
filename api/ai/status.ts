import { compactError, getProviderStatus } from '../_lib/ai.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  try {
    res.status(200).json(await getProviderStatus());
  } catch (error) {
    res.status(502).json({ error: compactError(error) });
  }
}
