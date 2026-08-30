import { isOrbiDocNativeRuntime } from './nativeRuntime';

export type OrbiDocPlatform = 'web' | 'desktop' | 'mobile';
export type OrbiDocWindowClass = 'compact' | 'medium' | 'expanded';

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

export function detectOrbiDocWindowClass(width = window.innerWidth): OrbiDocWindowClass {
  if (width < 600) return 'compact';
  if (width < 1024) return 'medium';
  return 'expanded';
}

export function detectOrbiDocPlatform(): OrbiDocPlatform {
  if (isMobileDevice()) return 'mobile';
  if (isStandalone()) return 'desktop';
  return 'web';
}

function applyRootProfile(root: HTMLElement) {
  const platform = detectOrbiDocPlatform();
  const windowClass = detectOrbiDocWindowClass();
  root.dataset.orbidocPlatform = platform;
  root.dataset.orbidocWindowClass = windowClass;
  root.dataset.orbidocStandalone = isStandalone() ? 'true' : 'false';
  root.dataset.orbidocNative = isOrbiDocNativeRuntime() ? 'true' : 'false';
  root.classList.remove(
    'orbidoc-platform-web',
    'orbidoc-platform-desktop',
    'orbidoc-platform-mobile',
    'orbidoc-window-compact',
    'orbidoc-window-medium',
    'orbidoc-window-expanded',
  );
  root.classList.add(`orbidoc-platform-${platform}`, `orbidoc-window-${windowClass}`);
}

export function applyOrbiDocPlatformProfile() {
  const root = document.documentElement;
  applyRootProfile(root);

  const update = () => applyRootProfile(root);
  const mediaQueries = [
    window.matchMedia?.('(max-width: 599px)'),
    window.matchMedia?.('(min-width: 600px) and (max-width: 1023px)'),
    window.matchMedia?.('(min-width: 1024px)'),
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