export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 25);
export const MAX_UPLOAD_BYTES = Math.max(1, MAX_UPLOAD_MB) * 1024 * 1024;

export function exceedsUploadLimit(file: File): boolean {
  return file.size > MAX_UPLOAD_BYTES;
}

export function uploadLimitMessage(fileName?: string): string {
  const subject = fileName ? `${fileName} ` : '';
  return `${subject}excede o limite de upload de ${MAX_UPLOAD_MB} MB.`;
}
