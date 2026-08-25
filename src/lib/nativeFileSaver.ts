import { isOrbiDocNativeRuntime } from './nativeRuntime';
import { downloadNativeUrl, saveNativeBlob } from './nativeAndroidBridge';

function browserSave(data: Blob | string, fileName?: string) {
  const anchor = document.createElement('a');
  anchor.rel = 'noopener';
  anchor.download = fileName || '';

  if (typeof data === 'string') {
    anchor.href = data;
    anchor.click();
    return;
  }

  const url = URL.createObjectURL(data);
  anchor.href = url;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

export function saveAs(data: Blob | string, fileName?: string) {
  if (!isOrbiDocNativeRuntime()) {
    browserSave(data, fileName);
    return;
  }

  if (typeof data === 'string') {
    if (/^https?:\/\//i.test(data)) {
      void downloadNativeUrl(data, fileName).catch((error) => {
        console.error('Falha no download nativo por URL:', error);
        browserSave(data, fileName);
      });
      return;
    }
    browserSave(data, fileName);
    return;
  }

  void saveNativeBlob(data, fileName || 'arquivo').catch((error) => {
    console.error('Falha ao salvar arquivo no Android:', error);
    browserSave(data, fileName);
  });
}

export default saveAs;
