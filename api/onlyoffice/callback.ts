import type { IncomingMessage, ServerResponse } from 'node:http';
import { decryptBridgeToken, getProject, jsonResponse, uploadOfficeFile, patchProject } from '../_lib/onlyofficeStorage.ts';
export default async function handler(req:IncomingMessage,res:ServerResponse){
  if(req.method!=='POST') return jsonResponse(res,405,{error:'METHOD_NOT_ALLOWED'});
  const url=new URL(req.url||'/','http://localhost'); const bridge=decryptBridgeToken(String(url.searchParams.get('token')||''),String(process.env.ONLYOFFICE_JWT_SECRET||''));
  if(!bridge||typeof bridge.projectId!=='string'||typeof bridge.idToken!=='string'||Number(bridge.exp||0)<Date.now()) return jsonResponse(res,401,{error:'CALLBACK_TOKEN_INVALID'});
  try{
    const chunks:Buffer[]=[]; for await(const chunk of req as any) chunks.push(Buffer.from(chunk)); const body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
    const status=Number(body.status||0); if(![2,6].includes(status)) return jsonResponse(res,200,{error:0});
    if(typeof body.url!=='string') return jsonResponse(res,200,{error:0});
    const project=await getProject(bridge.projectId,bridge.idToken); if(!project?.id) return jsonResponse(res,404,{error:'DOCUMENT_NOT_FOUND'});
    const download=await fetch(body.url); if(!download.ok) throw new Error(`ONLYOFFICE_DOWNLOAD_${download.status}`);
    const buffer=Buffer.from(await download.arrayBuffer()); if(buffer.length>25*1024*1024) throw new Error('DOCUMENT_TOO_LARGE');
    const kind=String(bridge.kind||'word') as 'word'|'excel'|'powerpoint'; const ext=kind==='word'?'docx':kind==='excel'?'xlsx':'pptx';
    const mime=kind==='word'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':kind==='excel'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const storageUrl=await uploadOfficeFile(`onlyoffice/${bridge.projectId}/${kind}.${ext}`,buffer,mime,bridge.idToken);
    await patchProject(bridge.projectId,bridge.idToken,{onlyOfficeStorageUrl:storageUrl,onlyOfficeFileType:ext,onlyOfficeSavedAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    return jsonResponse(res,200,{error:0});
  }catch(error){ return jsonResponse(res,500,{error:1,message:error instanceof Error?error.message:'Callback error'}); }
}
