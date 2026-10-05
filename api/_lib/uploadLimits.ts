const SERVER_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const SERVER_UPLOAD_MAX_BASE64_CHARS = Math.ceil(SERVER_UPLOAD_MAX_BYTES * 4 / 3);

export function assertBase64UploadSize(value: string, label = 'arquivo'): void {
  if (value.length > SERVER_UPLOAD_MAX_BASE64_CHARS) {
    throw new Error(`${label} excede o limite de payload do servidor (20 MB).`);
  }
}

export { SERVER_UPLOAD_MAX_BYTES, SERVER_UPLOAD_MAX_BASE64_CHARS };
