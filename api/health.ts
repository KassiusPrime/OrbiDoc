import { getHealth } from './_lib/ai';

export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(getHealth());
}
