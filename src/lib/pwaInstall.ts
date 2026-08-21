export type OrbiDocInstallDevice = 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'web';

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

export function applyInstalledStateToDocument(installed = isStandaloneInstalled()) {
  if (typeof document === 'undefined') return installed;
  document.documentElement.dataset.orbidocInstalled = installed ? 'true' : 'false';
  return installed;
}

function markLegacyInstallButtons(installed: boolean) {
  if (typeof document === 'undefined') return;
  const labels = ['Instalar OrbiDoc', 'Instalar / Android'];
  document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
    const match = labels.some((label) => text.includes(label));
    if (!match) return;
    button.dataset.orbidocInstallCta = 'true';
    button.hidden = installed;
  });
}

/**
 * Compatibility bridge while AppV5 still owns its legacy install CTAs.
 * New install UI reads the same document state, and installed PWA sessions
 * never keep showing the old download/install buttons.
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
    document.documentElement.dataset.orbidocInstalled = 'true';
    installed = true;
    markLegacyInstallButtons(true);
    window.dispatchEvent(new CustomEvent('orbidoc:install-state', { detail: { installed: true } }));
  };

  window.addEventListener('appinstalled', onInstalled);
  const media = window.matchMedia?.('(display-mode: standalone)');
  media?.addEventListener?.('change', refresh);
  const observer = new MutationObserver(() => markLegacyInstallButtons(installed || isStandaloneInstalled()));
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    window.removeEventListener('appinstalled', onInstalled);
    media?.removeEventListener?.('change', refresh);
    observer.disconnect();
  };
}
