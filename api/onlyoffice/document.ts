import type { IncomingMessage, ServerResponse } from 'node:http';
import { decryptBridgeToken, getProject, buildOfficeFile, jsonResponse } from '../_lib/onlyofficeStorage';
export default async function handler(req:IncomingMessage,res:ServerResponse){
 if(req.method!=='GET')return jsonResponse(res,405,{error:'METHOD_NOT_ALLOWED'});
 const u=new URL(req.url||'/','http://localhost'),secret=String(process.env.ONLYOFFICE_JWT_SECRET||''),b=decryptBridgeToken(String(u.searchParams.get('token')||''),secret);
 if(!b||typeof b.projectId!=='string'||typeof b.idToken!=='string'||Number(b.exp||0)<Date.now())return jsonResponse(res,401,{error:'DOCUMENT_TOKEN_INVALID'});
 try{const p=await getProject(b.projectId,b.idToken);if(!p?.id)return jsonResponse(res,404,{error:'DOCUMENT_NOT_FOUND'});const o=await buildOfficeFile(p,String(b.kind||'word') as any);res.statusCode=200;res.setHeader('Content-Type',o.mime);res.setHeader('Content-Disposition',`inline; filename="Orbit.${o.ext}"`);res.setHeader('Cache-Control','private, no-store');res.end(o.buffer);}catch(e){return jsonResponse(res,502,{error:'DOCUMENT_BRIDGE_ERROR',message:e instanceof Error?e.message:'Document bridge error'});}
}