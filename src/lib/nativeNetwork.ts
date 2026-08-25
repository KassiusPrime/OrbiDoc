import { isOrbiDocNativeRuntime } from './nativeRuntime';

export type NativeUrlPayload = {
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  sourceUrl: string;
};

function plugin() {
  if (!isOrbiDocNativeRuntime()) return null;
  return (window as any).Capacitor?.Plugins?.OrbiDocNative || null;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function fetchNativeUrlPayload(url: string): Promise<NativeUrlPayload> {
  const bridge = plugin();
  if (!bridge?.fetchUrlPayload) throw new Error('Download direto nativo não está disponível nesta instalação.');
  const result = await bridge.fetchUrlPayload({ url });
  if (!result?.dataBase64) throw new Error('O Android não retornou os dados do arquivo.');
  const mimeType = String(result.mimeType || 'application/octet-stream');
  const bytes = decodeBase64(String(result.dataBase64));
  return {
    blob: new Blob([bytes], { type: mimeType }),
    fileName: String(result.fileName || 'download'),
    mimeType,
    size: Number(result.size || bytes.byteLength),
    sourceUrl: String(result.sourceUrl || url),
  };
}
