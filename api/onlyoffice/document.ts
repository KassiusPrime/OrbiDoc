import type { IncomingMessage, ServerResponse } from 'node:http';
import { decryptBridgeToken, getProject, jsonResponse } from '../_lib/onlyofficeStorage';
import { buildOfficeFile } from '../_lib/onlyofficeStorage';
export default async function handler(req:IncomingMessage,res:ServerResponse){
  if(req.method!=='GET') return jsonResponse(res,405,{error:'METHOD_NOT_ALLOWED'});
  const url=new URL(req.url||'/','http://localhost'); const token=String(url.searchParams.get('token')||''); const secret=String(process.env.ONLYOFFICE_JWT_SECRET||'');
  if(!token||!secret) return jsonResponse(res,401,{error:'DOCUMENT_TOKEN_REQUIRED'});
  const bridge=decryptBridgeToken(token,secret);
  if(!bridge||typeof bridge.projectId!=='string'||typeof bridge.idToken!=='string'||Number(bridge.exp||0)<Date.now()) return jsonResponse(res,401,{error:'DOCUMENT_TOKEN_INVALID'});
  try{
    const project=await getProject(bridge.projectId,bridge.idToken); if(!project?.id) return jsonResponse(res,404,{error:'DOCUMENT_NOT_FOUND'});
    const kind=String(bridge.kind||'word') as 'word'|'excel'|'powerpoint';
    const office=await buildOfficeFile(project,kind);
    res.statusCode=200; res.setHeader('Content-Type',office.mime); res.setHeader('Content-Disposition',`inline; filename="Orbit.${office.ext}"`); res.setHeader('Cache-Control','private, no-store'); res.end(office.buffer);
  }catch(error){ return jsonResponse(res,502,{error:'DOCUMENT_BRIDGE_ERROR',message:error instanceof Error?error.message:'Document bridge error'}); }
}
