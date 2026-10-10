import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const clean = (value: unknown) => String(value ?? '').trim().replace(/\/$/, '');
const projectId = () => clean(process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID);
const databaseId = () => clean(process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID) || '(default)';
const storageBucket = () => clean(process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET);

export const jsonResponse = (res: any, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

export function encryptBridgeToken(payload: Record<string, unknown>, secret: string) {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

export function decryptBridgeToken(token: string, secret: string) {
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function firestore(path: string, token: string, init?: RequestInit) {
  const id = projectId();
  if (!id) throw new Error('FIREBASE_PROJECT_ID_NOT_CONFIGURED');
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(id)}/databases/${encodeURIComponent(databaseId())}/documents/${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    },
  );
  const raw = await response.text();
  let body: any;
  try { body = raw ? JSON.parse(raw) : null; } catch {}
  if (!response.ok) throw new Error(`FIRESTORE_${response.status}: ${body?.error?.message || raw || response.statusText}`);
  return body;
}

const fromFirestore = (value: any): any => {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(fromFirestore);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([key, item]) => [key, fromFirestore(item)]));
  return null;
};

const toFirestore = (value: any): any => {
  if (value == null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestore) } };
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestore(item)])) } };
  return { stringValue: String(value) };
};

export async function getProject(id: string, token: string) {
  const document = await firestore(`documents/documents/${encodeURIComponent(id)}`, token);
  return Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, fromFirestore(value)]));
}

export async function patchProject(id: string, token: string, fields: Record<string, any>) {
  const project = projectId();
  if (!project) throw new Error('FIREBASE_PROJECT_ID_NOT_CONFIGURED');
  const mask = Object.keys(fields).map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join('&');
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${encodeURIComponent(databaseId())}/documents/documents/${encodeURIComponent(id)}?${mask}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, toFirestore(value)])) }),
    },
  );
  if (!response.ok) throw new Error(`FIRESTORE_PATCH_${response.status}: ${await response.text()}`);
}

function lines(content: any): string[] {
  if (content == null) return [];
  if (typeof content === 'string') return content.replace(/<[^>]+>/g, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (Array.isArray(content)) return content.flatMap(lines);
  if (typeof content === 'object') return Object.entries(content).flatMap(([key, value]) => [`${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`]);
  return [String(content)];
}

export async function buildOfficeFile(project: any, kind: 'word' | 'excel' | 'powerpoint') {
  const title = String(project.title || 'Orbit');
  const contentLines = lines(project.content ?? project.details ?? project.summary ?? project.previewSnippet);

  if (kind === 'word') {
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const document = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32 })] }),
          ...contentLines.map((line) => new Paragraph(line)),
        ],
      }],
    });
    return {
      buffer: Buffer.from(await Packer.toBuffer(document)),
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ext: 'docx',
    };
  }

  if (kind === 'excel') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([['Orbit', title], ...(contentLines.length ? contentLines.map((line) => [line]) : [['']])]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orbit');
    return {
      buffer: Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ext: 'xlsx',
    };
  }

  const { default: PptxGenJS } = await import('pptxgenjs');
  const presentation = new PptxGenJS();
  presentation.layout = 'LAYOUT_WIDE';
  const slide = presentation.addSlide();
  slide.addText(title, { x: 0.7, y: 0.7, w: 11.2, h: 0.7, fontSize: 28, bold: true });
  if (contentLines.length) slide.addText(contentLines.join('\n'), { x: 0.9, y: 1.7, w: 10.8, h: 4.7, fontSize: 16, valign: 'top' });
  return {
    buffer: Buffer.from(await presentation.write({ outputType: 'nodebuffer' }) as Buffer),
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ext: 'pptx',
  };
}

export async function uploadOfficeFile(path: string, buffer: Buffer, mime: string, token: string) {
  const bucket = storageBucket();
  if (!bucket) throw new Error('FIREBASE_STORAGE_BUCKET_NOT_CONFIGURED');
  const response = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': mime, 'Content-Length': String(buffer.length) },
      body: new Uint8Array(buffer),
    },
  );
  if (!response.ok) throw new Error(`STORAGE_UPLOAD_${response.status}: ${await response.text()}`);
  const downloadToken = randomBytes(24).toString('hex');
  const objectPath = encodeURIComponent(path);
  const metadataResponse = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${objectPath}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { firebaseStorageDownloadTokens: downloadToken } }),
    },
  );
  if (!metadataResponse.ok) throw new Error(`STORAGE_METADATA_${metadataResponse.status}: ${await metadataResponse.text()}`);
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${objectPath}?alt=media&token=${encodeURIComponent(downloadToken)}`;
}
