import { isOrbiDocNativeRuntime } from './nativeRuntime';

export type OrbiDocPlatform = 'web' | 'desktop' | 'mobile';

const isStandalone = () => {
  if (isOrbiDocNativeRuntime()) return true;
  const navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return navigatorStandalone || window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: window-controls-overlay)').matches;
};

const isMobileDevice = () => {
  if (isOrbiDocNativeRuntime()) return true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const narrow = window.matchMedia?.('(max-width: 767px)').matches;
  const userAgentMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return Boolean((coarse && narrow) || userAgentMobile);
};

export function detectOrbiDocPlatform(): OrbiDocPlatform {
  if (isMobileDevice()) return 'mobile';
  if (isStandalone()) return 'desktop';
  return 'web';
}

export function applyOrbiDocPlatformProfile() {
  const root = document.documentElement;
  const platform = detectOrbiDocPlatform();
  root.dataset.orbidocPlatform = platform;
  root.dataset.orbidocStandalone = isStandalone() ? 'true' : 'false';
  root.dataset.orbidocNative = isOrbiDocNativeRuntime() ? 'true' : 'false';
  root.classList.remove('orbidoc-platform-web', 'orbidoc-platform-desktop', 'orbidoc-platform-mobile');
  root.classList.add(`orbidoc-platform-${platform}`);

  const update = () => {
    const next = detectOrbiDocPlatform();
    root.dataset.orbidocPlatform = next;
    root.dataset.orbidocStandalone = isStandalone() ? 'true' : 'false';
    root.dataset.orbidocNative = isOrbiDocNativeRuntime() ? 'true' : 'false';
    root.classList.remove('orbidoc-platform-web', 'orbidoc-platform-desktop', 'orbidoc-platform-mobile');
    root.classList.add(`orbidoc-platform-${next}`);
  };

  const mediaQueries = [
    window.matchMedia?.('(max-width: 767px)'),
    window.matchMedia?.('(pointer: coarse)'),
    window.matchMedia?.('(display-mode: standalone)'),
    window.matchMedia?.('(display-mode: window-controls-overlay)'),
  ].filter(Boolean) as MediaQueryList[];
  mediaQueries.forEach((query) => query.addEventListener?.('change', update));
  window.addEventListener('resize', update, { passive: true });

  return () => {
    mediaQueries.forEach((query) => query.removeEventListener?.('change', update));
    window.removeEventListener('resize', update);
  };
}