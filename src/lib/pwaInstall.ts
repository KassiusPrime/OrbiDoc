export type OrbiDocInstallDevice = 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'web';

const INSTALLED_HINT_KEY = 'orbidoc_installed_hint_v1';

export function isStandaloneInstalled() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
  );
}

export function detectInstallDevice(): OrbiDocInstallDevice {
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

export function isMobileInstallDevice() {
  const device = detectInstallDevice();
  return device === 'android' || device === 'ios';
}

export function hasInstalledHint() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(INSTALLED_HINT_KEY) === 'true';
}

export function currentInstalledState() {
  return isStandaloneInstalled() || (isMobileInstallDevice() && hasInstalledHint());
}

export function applyInstalledStateToDocument(installed = currentInstalledState()) {
  if (typeof document === 'undefined') return installed;
  document.documentElement.dataset.orbidocInstalled = installed ? 'true' : 'false';
  document.documentElement.dataset.orbidocMobile = isMobileInstallDevice() ? 'true' : 'false';
  return installed;
}

function looksLikeInstallTrigger(element: HTMLElement) {
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const aria = (element.getAttribute('aria-label') || '').toLowerCase();
  const title = (element.getAttribute('title') || '').toLowerCase();
  const values = [text, aria, title];
  return values.some((value) =>
    value === 'baixar app'
    || value === 'instalar app'
    || value === 'instalar orbidoc'
    || value.includes('instalar / android')
    || value.includes('baixar orbidoc'),
  );
}

function markLegacyInstallButtons(installed: boolean) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll<HTMLElement>('button, a').forEach((element) => {
    if (!looksLikeInstallTrigger(element)) return;
    element.dataset.orbidocInstallCta = 'true';
    const shouldHide = installed && isMobileInstallDevice();
    element.hidden = shouldHide;
    element.style.display = shouldHide ? 'none' : '';
  });
}

/**
 * Compatibility bridge while AppV5 owns legacy install CTAs.
 * The installed hint is persisted on mobile so the web shell does not keep
 * offering an app that was just installed. A new beforeinstallprompt event
 * clears stale hints after uninstall/reinstallation eligibility returns.
 */
export function mountPwaInstallStateAgent() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  let installed = applyInstalledStateToDocument();
  markLegacyInstallButtons(installed);

  const refresh = () => {
    installed = applyInstalledStateToDocument();
    markLegacyInstallButtons(installed);
    window.dispatchEvent(new CustomEvent('orbidoc:install-state', { detail: { installed } }));
  };

  const onInstalled = () => {
    try { localStorage.setItem(INSTALLED_HINT_KEY, 'true'); } catch { /* storage is optional */ }
    installed = true;
    applyInstalledStateToDocument(true);
    markLegacyInstallButtons(true);
    window.dispatchEvent(new CustomEvent('orbidoc:install-state', { detail: { installed: true } }));
  };

  const onInstallPrompt = () => {
    // Chrome exposes a fresh install prompt after uninstall; clear a stale hint.
    if (!isStandaloneInstalled()) {
      try { localStorage.removeItem(INSTALLED_HINT_KEY); } catch { /* storage is optional */ }
    }
    refresh();
  };

  window.addEventListener('appinstalled', onInstalled);
  window.addEventListener('beforeinstallprompt', onInstallPrompt as EventListener);
  const media = window.matchMedia?.('(display-mode: standalone)');
  media?.addEventListener?.('change', refresh);
  const observer = new MutationObserver(() => markLegacyInstallButtons(installed || currentInstalledState()));
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    window.removeEventListener('appinstalled', onInstalled);
    window.removeEventListener('beforeinstallprompt', onInstallPrompt as EventListener);
    media?.removeEventListener?.('change', refresh);
    observer.disconnect();
  };
}
