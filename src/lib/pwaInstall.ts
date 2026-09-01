import { isOrbiDocNativeRuntime } from './nativeRuntime';

/** Internal compatibility name; the product presented to users is Orbit. */
export type OrbiDocInstallDevice = 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'web';

const INSTALLED_HINT_KEY = 'orbit_installed_hint_v1';
const LEGACY_INSTALLED_HINT_KEY = 'orbidoc_installed_hint_v1';

export function isStandaloneInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (isOrbiDocNativeRuntime()) return true;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
  );
}

export function detectInstallDevice(): OrbiDocInstallDevice {
  if (isOrbiDocNativeRuntime()) {
    const nativePlatform = window.Capacitor?.getPlatform?.();
    if (nativePlatform === 'android') return 'android';
    if (nativePlatform === 'ios') return 'ios';
  }
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent.toLowerCase();
  const platform = String((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || '').toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua) || (platform.includes('mac') && navigator.maxTouchPoints > 1)) return 'ios';
  if (platform.includes('win') || ua.includes('windows')) return 'windows';
  if (platform.includes('mac') || ua.includes('macintosh')) return 'mac';
  if (platform.includes('linux') || ua.includes('linux')) return 'linux';
  return 'web';
}

export function isMobileInstallDevice(): boolean {
  const device = detectInstallDevice();
  return device === 'android' || device === 'ios';
}

export function hasInstalledHint(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(INSTALLED_HINT_KEY) === 'true'
    || localStorage.getItem(LEGACY_INSTALLED_HINT_KEY) === 'true';
}

export function currentInstalledState(): boolean {
  if (isOrbiDocNativeRuntime()) return true;
  return isStandaloneInstalled() || (isMobileInstallDevice() && hasInstalledHint());
}

export function applyInstalledStateToDocument(installed = currentInstalledState()): boolean {
  if (typeof document === 'undefined') return installed;
  // Legacy dataset names remain until the CSS/native profile migration is complete.
  document.documentElement.dataset.orbidocInstalled = installed ? 'true' : 'false';
  document.documentElement.dataset.orbidocMobile = isMobileInstallDevice() ? 'true' : 'false';
  document.documentElement.dataset.orbidocNative = isOrbiDocNativeRuntime() ? 'true' : 'false';
  document.documentElement.dataset.orbitInstalled = installed ? 'true' : 'false';
  return installed;
}

function looksLikeInstallTrigger(element: HTMLElement): boolean {
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const aria = (element.getAttribute('aria-label') || '').toLowerCase();
  const title = (element.getAttribute('title') || '').toLowerCase();
  const values = [text, aria, title];
  return values.some((value) =>
    value === 'baixar app'
    || value === 'instalar app'
    || value === 'instalar orbit'
    || value === 'instalar orbidoc'
    || value.includes('instalar / android')
    || value.includes('baixar orbit')
    || value.includes('baixar orbidoc'),
  );
}

function markInstallButtons(installed: boolean): void {
  if (typeof document === 'undefined') return;
  const native = isOrbiDocNativeRuntime();
  document.querySelectorAll<HTMLElement>('button, a').forEach((element) => {
    if (!looksLikeInstallTrigger(element)) return;
    element.dataset.orbidocInstallCta = 'true';
    element.dataset.orbitInstallCta = 'true';
    const shouldHide = native || (installed && isMobileInstallDevice());
    element.hidden = shouldHide;
    element.style.display = shouldHide ? 'none' : '';
  });
}

/**
 * Orbit install-state bridge. Native Android/iOS shells are always considered
 * installed and never expose a nested PWA install CTA. Legacy event/storage
 * names remain mirrored for safe upgrades from existing OrbiDoc installations.
 */
export function mountPwaInstallStateAgent(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;
  let installed = applyInstalledStateToDocument();
  markInstallButtons(installed);

  const emit = (value: boolean): void => {
    const detail = { installed: value };
    window.dispatchEvent(new CustomEvent('orbit:install-state', { detail }));
    window.dispatchEvent(new CustomEvent('orbidoc:install-state', { detail }));
  };

  const refresh = (): void => {
    installed = applyInstalledStateToDocument();
    markInstallButtons(installed);
    emit(installed);
  };

  const onInstalled = (): void => {
    if (!isOrbiDocNativeRuntime()) {
      try {
        localStorage.setItem(INSTALLED_HINT_KEY, 'true');
        localStorage.removeItem(LEGACY_INSTALLED_HINT_KEY);
      } catch {
        // Storage is optional.
      }
    }
    installed = true;
    applyInstalledStateToDocument(true);
    markInstallButtons(true);
    emit(true);
  };

  const onInstallPrompt = (): void => {
    if (isOrbiDocNativeRuntime()) return;
    if (!isStandaloneInstalled()) {
      try {
        localStorage.removeItem(INSTALLED_HINT_KEY);
        localStorage.removeItem(LEGACY_INSTALLED_HINT_KEY);
      } catch {
        // Storage is optional.
      }
    }
    refresh();
  };

  window.addEventListener('appinstalled', onInstalled);
  window.addEventListener('beforeinstallprompt', onInstallPrompt as EventListener);
  const media = window.matchMedia?.('(display-mode: standalone)');
  media?.addEventListener?.('change', refresh);
  const observer = new MutationObserver(() => markInstallButtons(installed || currentInstalledState()));
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    window.removeEventListener('appinstalled', onInstalled);
    window.removeEventListener('beforeinstallprompt', onInstallPrompt as EventListener);
    media?.removeEventListener?.('change', refresh);
    observer.disconnect();
  };
}
