import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';

const clean = (value: unknown) => String(value ?? '').trim().replace(/\/$/, '');
const firebaseProjectId = () => clean(process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID);
const firestoreDatabaseId = () => clean(process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID) || '(default)';
const storageBucket = () => clean(process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET);

export const jsonResponse = (res: any, status: number, body: unknown) => {
  res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body));
};

export function encryptBridgeToken(payload: Record<string, unknown>, secret: string) {
  const key = createHash('sha256').update(secret).digest(); const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function decryptBridgeToken(token: string, secret: string) {
  try {
    const raw = Buffer.from(token, 'base64url'); if (raw.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as Record<string, unknown>;
  } catch { return null; }
}

async function firestore(path: string, token: string, init?: RequestInit) {
  const pid = firebaseProjectId(); if (!pid) throw new Error('FIREBASE_PROJECT_ID_NOT_CONFIGURED');
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/${encodeURIComponent(firestoreDatabaseId())}/documents/${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const text = await response.text(); let body: any = null; try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(`FIRESTORE_${response.status}: ${body?.error?.message || text || response.statusText}`);
  return body;
}
const fromFirestoreValue = (v: any): any => {
  if (!v) return null; if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue; if ('booleanValue' in v) return v.booleanValue; if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null; if ('arrayValue' in v) return (v.arrayValue?.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue?.fields || {}).map(([k,x]) => [k, fromFirestoreValue(x)]));
  return null;
};
const toFirestoreValue = (v: any): any => {
  if (v === null || v === undefined) return { nullValue: null }; if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v }; if (typeof v === 'number' && Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === 'number') return { doubleValue: v }; if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k,x]) => [k, toFirestoreValue(x)])) } };
  return { stringValue: String(v) };
};
async function findProjectDocument(projectId: string, token: string) {
  const pid = firebaseProjectId();
  const apiKey = clean(process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY);
  if (!pid || !apiKey) throw new Error('FIREBASE_CONFIG_NOT_CONFIGURED');

  const identity = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
  });
  const identityBody = await identity.json().catch(() => null);
  if (!identity.ok) throw new Error(`FIREBASE_TOKEN_${identity.status}: ${identityBody?.error?.message || identity.statusText}`);
  const uid = String(identityBody?.users?.[0]?.localId || '');
  if (!uid) throw new Error('FIREBASE_USER_NOT_FOUND');

  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/${encodeURIComponent(firestoreDatabaseId())}/documents:runQuery`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'documents' }], where: { compositeFilter: { op: 'AND', filters: [
      { fieldFilter: { field: { fieldPath: 'id' }, op: 'EQUAL', value: { stringValue: projectId } } },
      { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } },
    ] } }, limit: 1 } }),
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error(`FIRESTORE_QUERY_${response.status}: ${rows?.error?.message || response.statusText}`);
  const row = Array.isArray(rows) ? rows.find((item: any) => item.document?.name) : null;
  return row?.document || null;
}

export async function getProject(projectId: string, token: string): Promise<any> {
  const doc = await findProjectDocument(projectId, token);
  if (!doc) return null;
  return { ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k,v]) => [k, fromFirestoreValue(v)])), _firestoreName: doc.name };
}

export async function patchProject(projectId: string, token: string, fields: Record<string, any>) {
  const doc = await findProjectDocument(projectId, token);
  if (!doc?.name) throw new Error('DOCUMENT_NOT_FOUND');
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const response = await fetch(`https://firestore.googleapis.com/v1/${doc.name}?${mask}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k,v]) => [k, toFirestoreValue(v)])) }),
  });
  if (!response.ok) throw new Error(`FIRESTORE_PATCH_${response.status}: ${await response.text()}`);
}

function contentToText(content: any): string[] {
  if (content === null || content === undefined) return []; if (typeof content === 'string') return content.replace(/<[^>]+>/g, '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if (Array.isArray(content)) return content.flatMap(contentToText); if (typeof content === 'object') return Object.entries(content).flatMap(([k,v])=>[`${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`]); return [String(content)];
}
export async function buildOfficeFile(project: any, kind: 'word'|'excel'|'powerpoint') {
  const title = String(project.title || 'Orbit'); const lines = contentToText(project.content ?? project.details ?? project.summary ?? project.previewSnippet);
  if (kind === 'word') {
    const doc = new Document({ sections: [{ properties: {}, children: [new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32 })] }), ...lines.map(line=>new Paragraph(line))] }] });
    return { buffer: Buffer.from(await Packer.toBuffer(doc)), mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' };
  }
  if (kind === 'excel') {
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet([['Orbit', title], ...(lines.length ? lines.map(x=>[x]) : [['']])]);
    XLSX.utils.book_append_sheet(wb, ws, 'Orbit');
    return { buffer: Buffer.from(XLSX.write(wb,{type:'buffer',bookType:'xlsx'})), mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext:'xlsx' };
  }
  const ppt = new PptxGenJS(); ppt.layout='LAYOUT_WIDE'; const slide=ppt.addSlide();
  slide.addText(title,{x:0.7,y:0.7,w:11.2,h:0.7,fontSize:28,bold:true}); if(lines.length) slide.addText(lines.join('\n'),{x:0.9,y:1.7,w:10.8,h:4.7,fontSize:16,valign:'top'});
  return { buffer: Buffer.from(await ppt.write({outputType:'nodebuffer'}) as Buffer), mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext:'pptx' };
}
export async function uploadOfficeFile(path: string, buffer: Buffer, mime: string, token: string) {
  const bucket = storageBucket(); if (!bucket) throw new Error('FIREBASE_STORAGE_BUCKET_NOT_CONFIGURED');
  const upload = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(path)}`, {
    method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':mime,'Content-Length':String(buffer.length)}, body:new Blob([new Uint8Array(buffer)],{type:mime})
  });
  if(!upload.ok) throw new Error(`STORAGE_UPLOAD_${upload.status}: ${await upload.text()}`);
  const downloadToken=randomBytes(24).toString('hex'); const objectPath=encodeURIComponent(path);
  const meta=await fetch(`https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${objectPath}`,{
    method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({metadata:{firebaseStorageDownloadTokens:downloadToken}})
  });
  if(!meta.ok) throw new Error(`STORAGE_METADATA_${meta.status}: ${await meta.text()}`);
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${objectPath}?alt=media&token=${encodeURIComponent(downloadToken)}`;
}
