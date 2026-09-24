import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, createHmac } from 'node:crypto';

const clean = (value: unknown) => String(value ?? '').trim().replace(/\/$/, '');
const json = (res: ServerResponse, status: number, body: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };

const signJwt = (payload: Record<string, unknown>, secret: string) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
};

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });

  const url = new URL(req.url || '/', 'http://localhost');
  const projectId = clean(url.searchParams.get('projectId'));
  const kind = clean(url.searchParams.get('kind')) || 'word';
  const server = clean(process.env.ONLYOFFICE_DOCUMENT_SERVER_URL || process.env.VITE_ONLYOFFICE_DOCUMENT_SERVER_URL);
  const documentBase = clean(process.env.ONLYOFFICE_DOCUMENT_URL_BASE);
  const callbackBase = clean(process.env.ONLYOFFICE_CALLBACK_URL_BASE);
  const jwtSecret = clean(process.env.ONLYOFFICE_JWT_SECRET);

  if (!projectId || !['word', 'excel', 'powerpoint'].includes(kind)) return json(res, 400, { error: 'INVALID_DOCUMENT_REQUEST' });
  if (!server || !documentBase || !callbackBase) return json(res, 503, { error: 'ONLYOFFICE_NOT_CONFIGURED', required: ['ONLYOFFICE_DOCUMENT_SERVER_URL', 'ONLYOFFICE_DOCUMENT_URL_BASE', 'ONLYOFFICE_CALLBACK_URL_BASE'] });

  const documentUrl = `${documentBase}/${encodeURIComponent(projectId)}`;
  const callbackUrl = `${callbackBase}/${encodeURIComponent(projectId)}`;
  const key = createHash('sha256').update(`${projectId}:${kind}`).digest('hex').slice(0, 40);
  const payload = {
    document: {
      fileType: kind === 'word' ? 'docx' : kind === 'excel' ? 'xlsx' : 'pptx',
      key,
      title: `Orbit ${kind} ${projectId}`,
      url: documentUrl,
      permissions: { edit: true, download: true, print: true, review: true, comment: true, fillForms: true, copy: true },
    },
    documentType: kind === 'word' ? 'word' : kind === 'excel' ? 'cell' : 'slide',
    editorConfig: {
      mode: 'edit',
      callbackUrl,
      customization: { autosave: true, forcesave: false, compactHeader: true, compactToolbar: false },
      user: { id: projectId.slice(0, 64), name: 'Orbit user' },
    },
    height: '100%',
    width: '100%',
  };
  if (jwtSecret) (payload as Record<string, unknown>).token = signJwt(payload, jwtSecret);
  return json(res, 200, payload);
}
