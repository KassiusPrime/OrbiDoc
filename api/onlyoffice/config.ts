import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, createHmac } from 'node:crypto';
import { getProject, uploadOfficeFile, buildOfficeFile, encryptBridgeToken, jsonResponse, patchProject } from '../_lib/onlyofficeStorage';

const clean=(v:unknown)=>String(v??'').trim().replace(/\/$/,'');
const signJwt=(p:Record<string,unknown>,s:string)=>{const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),b=Buffer.from(JSON.stringify(p)).toString('base64url'),d=`${h}.${b}`;return`${d}.${createHmac('sha256',s).update(d).digest('base64url')}`;};

export default async function handler(req:IncomingMessage,res:ServerResponse){
 if(req.method!=='GET')return jsonResponse(res,405,{error:'METHOD_NOT_ALLOWED'});
 const u=new URL(req.url||'/','http://localhost'),projectId=clean(u.searchParams.get('projectId')),kind=clean(u.searchParams.get('kind'))||'word';
 const server=clean(process.env.ONLYOFFICE_DOCUMENT_SERVER_URL||process.env.VITE_ONLYOFFICE_DOCUMENT_SERVER_URL),secret=clean(process.env.ONLYOFFICE_JWT_SECRET),auth=String(req.headers.authorization||''),idToken=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
 if(!projectId||!['word','excel','powerpoint'].includes(kind))return jsonResponse(res,400,{error:'INVALID_DOCUMENT_REQUEST'});
 if(!server||!secret)return jsonResponse(res,503,{error:'ONLYOFFICE_NOT_CONFIGURED',required:['ONLYOFFICE_DOCUMENT_SERVER_URL','ONLYOFFICE_JWT_SECRET']});
 if(!idToken)return jsonResponse(res,401,{error:'FIREBASE_AUTH_REQUIRED'});
 try{
  const project=await getProject(projectId,idToken);if(!project?.id||project.id!==projectId)return jsonResponse(res,404,{error:'DOCUMENT_NOT_FOUND'});
  let documentUrl=clean(project.onlyOfficeStorageUrl);
  if(!documentUrl){const office=await buildOfficeFile(project,kind as any);documentUrl=`${u.origin}/api/onlyoffice/document?token=${encodeURIComponent(encryptBridgeToken({projectId,kind,idToken,exp:Date.now()+55*60*1000},secret))}`;await uploadOfficeFile(`onlyoffice/${projectId}/${kind}.${office.ext}`,office.buffer,office.mime,idToken);await patchProject(projectId,idToken,{onlyOfficeFileType:office.ext});}
  const bridge=encryptBridgeToken({projectId,kind,idToken,exp:Date.now()+55*60*1000},secret);
  const callbackUrl=`${u.origin}/api/onlyoffice/callback?token=${encodeURIComponent(bridge)}`;
  if(project.onlyOfficeStorageUrl)documentUrl=project.onlyOfficeStorageUrl;
  else documentUrl=`${u.origin}/api/onlyoffice/document?token=${encodeURIComponent(bridge)}`;
  const payload:any={document:{fileType:kind==='word'?'docx':kind==='excel'?'xlsx':'pptx',key:createHash('sha256').update(`${projectId}:${kind}:${documentUrl}`).digest('hex').slice(0,40),title:String(project.title||'Orbit'),url:documentUrl,permissions:{edit:true,download:true,print:true,review:true,comment:true,fillForms:true,copy:true}},documentType:kind==='word'?'word':kind==='excel'?'cell':'slide',editorConfig:{mode:'edit',callbackUrl,customization:{autosave:true,forcesave:true,compactHeader:true},user:{id:projectId.slice(0,64),name:'Orbit user'}},height:'100%',width:'100%'};
  payload.token=signJwt(payload,secret);payload.documentServerUrl=server;return jsonResponse(res,200,payload);
 }catch(e){return jsonResponse(res,502,{error:'ONLYOFFICE_BRIDGE_ERROR',message:e instanceof Error?e.message:'Bridge error'});}
}