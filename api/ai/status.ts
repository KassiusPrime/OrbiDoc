import { compactError } from '../_lib/ai.js';
import { getProviderStatusV2 } from '../_lib/aiRuntimeV2.js';
import { hydrateGatewayRuntimeAuth } from '../_lib/gatewayAuth.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  await hydrateGatewayRuntimeAuth();
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.status(200).json(await getProviderStatusV2());
  } catch (error) {
    res.status(502).json({ error: compactError(error) });
  }
}
