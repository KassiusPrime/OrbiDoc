import { getVerifiedImageGenerationStatus } from './_lib/imageRuntime.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(getImageGenerationStatus());
}
