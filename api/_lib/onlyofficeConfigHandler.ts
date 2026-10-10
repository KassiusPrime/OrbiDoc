import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, createHmac } from 'node:crypto';
import { getProject, buildOfficeFile, encryptBridgeToken, jsonResponse } from './onlyofficeStorage.js';

const clean = (value: unknown) => String(value ?? '').trim().replace(/\/$/, '');
const signJwt = (payload: Record<string, unknown>, secret: string) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
};

function publicOrigin(req: IncomingMessage): string {
  const explicit = clean(process.env.ONLYOFFICE_PUBLIC_ORIGIN);
  const deploymentHost = clean(process.env.VERCEL_URL);
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const requestHost = String(req.headers.host || '').split(',')[0].trim();
  const host = explicit || deploymentHost || forwardedHost || requestHost;
  if (!host) return '';
  try {
    const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(host) ? host : `${deploymentHost || explicit ? 'https' : (process.env.NODE_ENV === 'production' ? 'https' : 'http')}://${host}`);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

export default async function onlyOfficeConfigHandler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const u = new URL(req.url || '/', 'http://localhost');
  const projectId = clean(u.searchParams.get('projectId'));
  const kind = clean(u.searchParams.get('kind')) || 'word';
  const server = clean(process.env.ONLYOFFICE_DOCUMENT_SERVER_URL || process.env.VITE_ONLYOFFICE_DOCUMENT_SERVER_URL);
  const secret = clean(process.env.ONLYOFFICE_JWT_SECRET);
  const auth = String(req.headers.authorization || '');
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!projectId || !['word', 'excel', 'powerpoint'].includes(kind)) return jsonResponse(res, 400, { error: 'INVALID_DOCUMENT_REQUEST' });
  if (!server || !secret) return jsonResponse(res, 503, { error: 'ONLYOFFICE_NOT_CONFIGURED', required: ['ONLYOFFICE_DOCUMENT_SERVER_URL', 'ONLYOFFICE_JWT_SECRET'] });
  if (!idToken) return jsonResponse(res, 401, { error: 'FIREBASE_AUTH_REQUIRED' });

  const origin = publicOrigin(req);
  if (!origin) return jsonResponse(res, 503, { error: 'PUBLIC_ORIGIN_NOT_CONFIGURED' });

  try {
    const project = await getProject(projectId, idToken);
    if (!project?.id || project.id !== projectId) return jsonResponse(res, 404, { error: 'DOCUMENT_NOT_FOUND' });
    const storageField = kind === 'word' ? 'onlyOfficeStorageUrlWord' : kind === 'excel' ? 'onlyOfficeStorageUrlExcel' : 'onlyOfficeStorageUrlPowerpoint';
    let documentUrl = clean(project[storageField]);
    const bridge = encryptBridgeToken({ projectId, kind, idToken, exp: Date.now() + 55 * 60 * 1000 }, secret);
    if (!documentUrl) documentUrl = `${origin}/api/onlyoffice/document?token=${encodeURIComponent(bridge)}`;
    const callbackUrl = `${origin}/api/onlyoffice/callback?token=${encodeURIComponent(bridge)}`;
    const sourceVersion = project[storageField]
      ? String(project[storageField])
      : JSON.stringify({ title: project.title || '', content: project.content ?? project.details ?? project.summary ?? project.previewSnippet ?? '', updatedAt: project.updatedAt || '', createdAt: project.createdAt || '' });
    const key = createHash('sha256').update(`${projectId}:${kind}:${sourceVersion}`).digest('hex').slice(0, 40);
    const payload: Record<string, any> = {
      document: {
        fileType: kind === 'word' ? 'docx' : kind === 'excel' ? 'xlsx' : 'pptx',
        key,
        title: String(project.title || 'Orbit'),
        url: documentUrl,
        permissions: { edit: true, download: true, print: true, review: true, comment: true, fillForms: true, copy: true },
      },
      documentType: kind === 'word' ? 'word' : kind === 'excel' ? 'cell' : 'slide',
      editorConfig: {
        mode: 'edit',
        callbackUrl,
        customization: { autosave: true, forcesave: true, compactHeader: true },
        user: { id: projectId.slice(0, 64), name: 'Orbit user' },
      },
      height: '100%',
      width: '100%',
    };
    payload.token = signJwt(payload, secret);
    payload.documentServerUrl = server;
    return jsonResponse(res, 200, payload);
  } catch (error) {
    return jsonResponse(res, 502, { error: 'ONLYOFFICE_BRIDGE_ERROR', message: error instanceof Error ? error.message : 'Bridge error' });
  }
}
