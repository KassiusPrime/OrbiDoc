import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHmac, createHash } from 'node:crypto';
import { decryptBridgeToken, encryptBridgeToken, getProject, jsonResponse, buildOfficeFile, uploadOfficeFile } from '../_lib/onlyofficeStorage.ts';

const clean = (value: unknown) => String(value ?? '').trim().replace(/\/$/, '');
const signJwt = (payload: Record<string, unknown>, secret: string) => {
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url'); const data=`${header}.${body}`;
  return `${data}.${createHmac('sha256',secret).update(data).digest('base64url')}`;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if(req.method!=='GET') return jsonResponse(res,405,{error:'METHOD_NOT_ALLOWED'});
  const url=new URL(req.url||'/','http://localhost'); const projectId=clean(url.searchParams.get('projectId')); const kind=clean(url.searchParams.get('kind'))||'word';
  const server=clean(process.env.ONLYOFFICE_DOCUMENT_SERVER_URL||process.env.VITE_ONLYOFFICE_DOCUMENT_SERVER_URL);
  const secret=clean(process.env.ONLYOFFICE_JWT_SECRET); const auth=String(req.headers.authorization||'');
  const idToken=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
  if(!projectId || !['word','excel','powerpoint'].includes(kind)) return jsonResponse(res,400,{error:'INVALID_DOCUMENT_REQUEST'});
  if(!server || !secret) return jsonResponse(res,503,{error:'ONLYOFFICE_NOT_CONFIGURED',required:['ONLYOFFICE_DOCUMENT_SERVER_URL','ONLYOFFICE_JWT_SECRET']});
  if(!idToken) return jsonResponse(res,401,{error:'FIREBASE_AUTH_REQUIRED'});
  try {
    const project=await getProject(projectId,idToken);
    if(!project?.id || project.id!==projectId) return jsonResponse(res,404,{error:'DOCUMENT_NOT_FOUND'});
    const origin=`${url.protocol}//${url.host}`;
    const bridgePayload={projectId,kind,idToken,exp:Date.now()+55*60*1000};
    const bridge=encryptBridgeToken(bridgePayload,secret);
    let documentUrl=clean(project.onlyOfficeStorageUrl);
    if(!documentUrl) {
      const office=await buildOfficeFile(project,kind as any);
      documentUrl=await uploadOfficeFile(`onlyoffice/${projectId}/${kind}.${office.ext}`,office.buffer,office.mime,idToken);
      await import('../_lib/onlyofficeStorage').then(m=>m.patchProject(projectId,idToken,{onlyOfficeStorageUrl:documentUrl,onlyOfficeFileType:office.ext}));
    }
    const callbackUrl=`${origin}/api/onlyoffice/callback?token=${encodeURIComponent(bridge)}`;
    const key=createHash('sha256').update(`${projectId}:${kind}:${project.onlyOfficeStorageUrl||documentUrl}`).digest('hex').slice(0,40);
    const payload:any={documentServerUrl:server,document:{fileType:kind==='word'?'docx':kind==='excel'?'xlsx':'pptx',key,title:`${project.title||'Orbit'}`,url:documentUrl,permissions:{edit:true,download:true,print:true,review:true,comment:true,fillForms:true,copy:true}},documentType:kind==='word'?'word':kind==='excel'?'cell':'slide',editorConfig:{mode:'edit',callbackUrl,customization:{autosave:true,forcesave:true,compactHeader:true,compactToolbar:false},user:{id:projectId.slice(0,64),name:'Orbit user'}},height:'100%',width:'100%'};
    payload.token=signJwt(payload,secret);
    return jsonResponse(res,200,payload);
  } catch(error) { return jsonResponse(res,502,{error:'ONLYOFFICE_BRIDGE_ERROR',message:error instanceof Error?error.message:'Bridge error'}); }
}
