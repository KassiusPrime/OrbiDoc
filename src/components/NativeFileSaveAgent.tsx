import React, { useEffect } from 'react';
import { isNativeBridgeAvailable, saveNativeBlob } from '../lib/nativeAndroidBridge';
import { isOrbiDocNativeRuntime } from '../lib/nativeRuntime';

const BYPASS = 'orbidocNativeSaveBypass';

function downloadableAnchor(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const anchor = element?.closest<HTMLAnchorElement>('a[download]') || null;
  if (!anchor || anchor.dataset[BYPASS] === 'true') return null;
  const href = anchor.href || anchor.getAttribute('href') || '';
  if (!href.startsWith('blob:') && !href.startsWith('data:')) return null;
  return anchor;
}

function browserFallback(anchor: HTMLAnchorElement) {
  anchor.dataset[BYPASS] = 'true';
  try {
    anchor.click();
  } finally {
    window.queueMicrotask(() => delete anchor.dataset[BYPASS]);
  }
}

/**
 * FileSaver and several exporters ultimately trigger an <a download> click.
 * In the Android APK we intercept that final browser action and write the Blob
 * through MediaStore, so every creator saves consistently to Downloads/OrbiDoc.
 * Web/PWA behavior remains untouched.
 */
export const NativeFileSaveAgent: React.FC = () => {
  useEffect(() => {
    if (!isOrbiDocNativeRuntime() || !isNativeBridgeAvailable()) return;

    const handleDownload = (event: MouseEvent) => {
      const anchor = downloadableAnchor(event.target);
      if (!anchor) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const href = anchor.href || anchor.getAttribute('href') || '';
      const fileName = anchor.download || 'arquivo';

      void (async () => {
        try {
          const response = await fetch(href);
          if (!response.ok && !href.startsWith('data:') && !href.startsWith('blob:')) {
            throw new Error(`Falha ao preparar o arquivo (${response.status}).`);
          }
          const blob = await response.blob();
          const result = await saveNativeBlob(blob, fileName);
          window.dispatchEvent(new CustomEvent('orbidoc:native-export-openable', {
            detail: { ...result, fileName, mimeType: blob.type || 'application/octet-stream' },
          }));
        } catch (error) {
          console.error('Falha ao salvar exportação pelo MediaStore; usando fallback do WebView.', error);
          browserFallback(anchor);
        }
      })();
    };

    document.addEventListener('click', handleDownload, true);
    return () => document.removeEventListener('click', handleDownload, true);
  }, []);

  return null;
};