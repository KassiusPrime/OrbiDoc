import { isOrbiDocNativeRuntime } from './nativeRuntime';

export type OrbiDocPlatform = 'web' | 'desktop' | 'mobile' | 'app';
export type OrbiDocInputMode = 'touch' | 'pointer';
export type OrbiDocFormFactor = 'phone' | 'tablet' | 'wide';

const isStandalone = () => {
  const navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return navigatorStandalone
    || Boolean(window.matchMedia?.('(display-mode: standalone)').matches)
    || Boolean(window.matchMedia?.('(display-mode: window-controls-overlay)').matches);
};

const isMobileBrowser = () => {
  if (isOrbiDocNativeRuntime()) return false;
  const coarse = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  const narrow = Boolean(window.matchMedia?.('(max-width: 900px)').matches);
  const userAgentMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return Boolean((coarse && narrow) || userAgentMobile);
};

const detectInputMode = (): OrbiDocInputMode => (
  window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'pointer'
);

const detectFormFactor = (): OrbiDocFormFactor => {
  const width = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
  if (width < 640) return 'phone';
  if (width < 1024) return 'tablet';
  return 'wide';
};

export function detectOrbiDocPlatform(): OrbiDocPlatform {
  if (isOrbiDocNativeRuntime()) return 'app';
  if (isMobileBrowser()) return 'mobile';
  if (isStandalone()) return 'desktop';
  return 'web';
}

const PLATFORM_CLASSES = [
  'orbidoc-platform-web',
  'orbidoc-platform-desktop',
  'orbidoc-platform-mobile',
  'orbidoc-platform-app',
  'orbidoc-input-touch',
  'orbidoc-input-pointer',
  'orbidoc-form-phone',
  'orbidoc-form-tablet',
  'orbidoc-form-wide',
] as const;

function syncRootProfile(root: HTMLElement) {
  const platform = detectOrbiDocPlatform();
  const inputMode = detectInputMode();
  const formFactor = detectFormFactor();
  const native = isOrbiDocNativeRuntime();

  root.dataset.orbidocPlatform = platform;
  root.dataset.orbidocStandalone = isStandalone() ? 'true' : 'false';
  root.dataset.orbidocNative = native ? 'true' : 'false';
  root.dataset.orbidocInput = inputMode;
  root.dataset.orbidocFormFactor = formFactor;

  root.classList.remove(...PLATFORM_CLASSES);
  root.classList.add(`orbidoc-platform-${platform}`);
  root.classList.add(`orbidoc-input-${inputMode}`);
  root.classList.add(`orbidoc-form-${formFactor}`);

  // The native app inherits the battle-tested touch/safe-area baseline while
  // receiving its own app-specific class for native-only layout overrides.
  if (platform === 'app') root.classList.add('orbidoc-platform-mobile');
}

export function applyOrbiDocPlatformProfile() {
  const root = document.documentElement;
  syncRootProfile(root);

  const update = () => syncRootProfile(root);
  const mediaQueries = [
    window.matchMedia?.('(max-width: 639px)'),
    window.matchMedia?.('(max-width: 900px)'),
    window.matchMedia?.('(max-width: 1023px)'),
    window.matchMedia?.('(pointer: coarse)'),
    window.matchMedia?.('(display-mode: standalone)'),
    window.matchMedia?.('(display-mode: window-controls-overlay)'),
  ].filter(Boolean) as MediaQueryList[];

  mediaQueries.forEach((query) => query.addEventListener?.('change', update));
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('orientationchange', update, { passive: true });

  return () => {
    mediaQueries.forEach((query) => query.removeEventListener?.('change', update));
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', update);
  };
}
