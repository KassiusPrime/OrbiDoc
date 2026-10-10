import type { IncomingMessage, ServerResponse } from 'node:http';
import { decryptBridgeToken, getProject, buildOfficeFile, jsonResponse } from './onlyofficeStorage';
export default async function onlyOfficeDocumentHandler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const u = new URL(req.url || '/', 'http://localhost');
  const secret = String(process.env.ONLYOFFICE_JWT_SECRET || '');
  const bridge = decryptBridgeToken(String(u.searchParams.get('token') || ''), secret);
  if (!bridge || typeof bridge.projectId !== 'string' || typeof bridge.idToken !== 'string' || Number(bridge.exp || 0) < Date.now() || !['word', 'excel', 'powerpoint'].includes(String(bridge.kind || ''))) {
    return jsonResponse(res, 401, { error: 'DOCUMENT_TOKEN_INVALID' });
  }
  try {
    const project = await getProject(bridge.projectId, bridge.idToken);
    if (!project?.id || project.id !== bridge.projectId) return jsonResponse(res, 404, { error: 'DOCUMENT_NOT_FOUND' });
    const office = await buildOfficeFile(project, String(bridge.kind) as 'word' | 'excel' | 'powerpoint');
    res.statusCode = 200;
    res.setHeader('Content-Type', office.mime);
    res.setHeader('Content-Disposition', `inline; filename="Orbit.${office.ext}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(office.buffer);
  } catch (error) {
    return jsonResponse(res, 502, { error: 'DOCUMENT_BRIDGE_ERROR', message: error instanceof Error ? error.message : 'Document bridge error' });
  }
}
