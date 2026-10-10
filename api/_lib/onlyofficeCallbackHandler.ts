import type { IncomingMessage, ServerResponse } from 'node:http';
import { decryptBridgeToken, getProject, jsonResponse, patchProject, uploadOfficeFile } from './onlyofficeStorage.js';

const MAX_CALLBACK_BODY_BYTES = 1024 * 1024;
const trustedDownloadUrl = (candidate: string, configuredServer: string) => {
  try {
    const target = new URL(candidate);
    const server = new URL(configuredServer);
    return target.origin === server.origin && !target.username && !target.password;
  } catch {
    return false;
  }
};

export default async function onlyOfficeCallbackHandler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const secret = String(process.env.ONLYOFFICE_JWT_SECRET || '');
  if (!secret) return jsonResponse(res, 503, { error: 'ONLYOFFICE_NOT_CONFIGURED' });
  const u = new URL(req.url || '/', 'http://localhost');
  const bridge = decryptBridgeToken(String(u.searchParams.get('token') || ''), secret);
  if (!bridge || typeof bridge.projectId !== 'string' || typeof bridge.idToken !== 'string' || Number(bridge.exp || 0) < Date.now() || !['word', 'excel', 'powerpoint'].includes(String(bridge.kind || ''))) {
    return jsonResponse(res, 401, { error: 'CALLBACK_TOKEN_INVALID' });
  }

  try {
    const request = req as any;
    let body: any;
    if (request.body !== undefined && request.body !== null) {
      const serialized = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      if (Buffer.byteLength(serialized) > MAX_CALLBACK_BODY_BYTES) return jsonResponse(res, 413, { error: 'CALLBACK_PAYLOAD_TOO_LARGE' });
      body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body;
    } else {
      const chunks: Buffer[] = [];
      let bodyBytes = 0;
      for await (const chunk of req as any) {
        const part = Buffer.from(chunk);
        bodyBytes += part.length;
        if (bodyBytes > MAX_CALLBACK_BODY_BYTES) return jsonResponse(res, 413, { error: 'CALLBACK_PAYLOAD_TOO_LARGE' });
        chunks.push(part);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    }
    const status = Number(body.status);
    if (![2, 6].includes(status)) return jsonResponse(res, 200, { error: 0 });
    if (typeof body.url !== 'string' || typeof body.key !== 'string') return jsonResponse(res, 400, { error: 1, message: 'INVALID_CALLBACK_PAYLOAD' });

    const documentServer = String(process.env.ONLYOFFICE_DOCUMENT_SERVER_URL || process.env.VITE_ONLYOFFICE_DOCUMENT_SERVER_URL || '').trim().replace(/\/$/, '');
    if (!documentServer || !trustedDownloadUrl(body.url, documentServer)) return jsonResponse(res, 400, { error: 1, message: 'UNTRUSTED_DOCUMENT_URL' });
    const project = await getProject(bridge.projectId, bridge.idToken);
    if (!project?.id || project.id !== bridge.projectId) return jsonResponse(res, 404, { error: 'DOCUMENT_NOT_FOUND' });

    const kind = String(bridge.kind) as 'word' | 'excel' | 'powerpoint';
    const ext = kind === 'word' ? 'docx' : kind === 'excel' ? 'xlsx' : 'pptx';
    const mime = kind === 'word'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : kind === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const download = await fetch(body.url, { redirect: 'error' });
    if (!download.ok) throw new Error(`ONLYOFFICE_DOWNLOAD_${download.status}`);
    const file = Buffer.from(await download.arrayBuffer());
    if (file.length > 25 * 1024 * 1024) throw new Error('DOCUMENT_TOO_LARGE');

    const storage = await uploadOfficeFile(`onlyoffice/${bridge.projectId}/${kind}.${ext}`, file, mime, bridge.idToken);
    const storageField = kind === 'word' ? 'onlyOfficeStorageUrlWord' : kind === 'excel' ? 'onlyOfficeStorageUrlExcel' : 'onlyOfficeStorageUrlPowerpoint';
    await patchProject(bridge.projectId, bridge.idToken, {
      [storageField]: storage,
      onlyOfficeFileType: ext,
      onlyOfficeSavedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return jsonResponse(res, 200, { error: 0 });
  } catch (error) {
    return jsonResponse(res, 500, { error: 1, message: error instanceof Error ? error.message : 'Callback error' });
  }
}
