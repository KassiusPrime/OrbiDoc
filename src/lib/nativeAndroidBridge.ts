import { isOrbiDocNativeRuntime } from './nativeRuntime';

type NativePlugin = {
  saveBase64File: (options: { fileName: string; mimeType: string; dataBase64: string }) => Promise<{ uri?: string; fileName?: string }>;
  downloadUrl: (options: { url: string; fileName?: string; mimeType?: string }) => Promise<{ uri?: string; fileName?: string }>;
  openUri: (options: { uri: string; mimeType?: string }) => Promise<void>;
  consumeOpenFile: () => Promise<{ available?: boolean; name?: string; mimeType?: string; dataBase64?: string }>;
};

type LaunchFile = { name: string; getFile: () => Promise<File> };
type LaunchConsumer = (params: { files: LaunchFile[] }) => void;
type LaunchQueue = { setConsumer: (consumer: LaunchConsumer) => void };
type OrbitWindow = Window & {
  Capacitor?: { Plugins?: { OrbiDocNative?: NativePlugin } };
  launchQueue?: LaunchQueue;
};

function plugin(): NativePlugin | null {
  if (!isOrbiDocNativeRuntime()) return null;
  return (window as OrbitWindow).Capacitor?.Plugins?.OrbiDocNative ?? null;
}

export function isNativeBridgeAvailable(): boolean {
  return Boolean(plugin());
}

/**
 * Nexus AI is intentionally NOT intercepted by the Android bridge anymore.
 * Web, PWA, desktop and Capacitor all use the same server-side OpenRouter
 * free-only orchestrator. This prevents provider drift and keeps API keys out
 * of the frontend/Android WebView contract.
 */
export function installNativeAiApiBridge(): false {
  return false;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  }
  return btoa(binary);
}

export async function saveNativeBlob(blob: Blob, fileName: string) {
  const bridge = plugin();
  if (!bridge) throw new Error('Downloads nativos indisponíveis.');
  const result = await bridge.saveBase64File({
    fileName: fileName || 'arquivo',
    mimeType: blob.type || 'application/octet-stream',
    dataBase64: arrayBufferToBase64(await blob.arrayBuffer()),
  });
  window.dispatchEvent(new CustomEvent('orbidoc:native-download', { detail: result }));
  return result;
}

export async function downloadNativeUrl(url: string, fileName?: string, mimeType?: string) {
  const bridge = plugin();
  if (!bridge) throw new Error('Downloads nativos indisponíveis.');
  const result = await bridge.downloadUrl({ url, fileName, mimeType });
  window.dispatchEvent(new CustomEvent('orbidoc:native-download', { detail: result }));
  return result;
}

export async function openNativeUri(uri: string, mimeType?: string): Promise<void> {
  const bridge = plugin();
  if (!bridge) return;
  await bridge.openUri({ uri, mimeType });
}

let launchConsumer: LaunchConsumer | null = null;
let drainingOpenFile = false;

async function drainPendingOpenFile(): Promise<void> {
  if (!launchConsumer || drainingOpenFile) return;
  const bridge = plugin();
  if (!bridge) return;
  drainingOpenFile = true;
  try {
    const result = await bridge.consumeOpenFile();
    if (!result.available || !result.dataBase64) return;
    const binary = atob(result.dataBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const file = new File([bytes], result.name || 'arquivo', { type: result.mimeType || 'application/octet-stream' });
    launchConsumer({ files: [{ name: file.name, getFile: async () => file }] });
  } catch (error) {
    console.error('Falha ao abrir arquivo recebido pelo Android:', error);
  } finally {
    drainingOpenFile = false;
  }
}

export function installNativeFileOpenBridge(): boolean {
  if (!isOrbiDocNativeRuntime() || !plugin()) return false;
  const target = window as OrbitWindow;
  if (!target.launchQueue) {
    target.launchQueue = {
      setConsumer(consumer: LaunchConsumer) {
        launchConsumer = consumer;
        void drainPendingOpenFile();
      },
    };
  }
  const drain = () => void drainPendingOpenFile();
  window.addEventListener('focus', drain);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) drain(); });
  window.setInterval(drain, 1800);
  return true;
}
