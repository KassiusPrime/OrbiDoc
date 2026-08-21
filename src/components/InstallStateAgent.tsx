import React, { useEffect } from 'react';

const INSTALLED_HINT_KEY = 'orbidoc_installed_hint_v1';

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isMobileDevice() {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (typeof nav.userAgentData?.mobile === 'boolean') return nav.userAgentData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.matchMedia?.('(pointer: coarse)').matches;
}

function markInstallTriggers() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, a'));
  for (const element of candidates) {
    const text = (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const aria = (element.getAttribute('aria-label') || '').toLowerCase();
    const title = (element.getAttribute('title') || '').toLowerCase();
    const installText = text === 'baixar app'
      || text === 'instalar app'
      || text === 'instalar orbidoc'
      || aria.includes('baixar app')
      || aria.includes('instalar app')
      || title.includes('baixar app');
    if (installText) element.classList.add('orbidoc-install-trigger');
  }
}

function applyState(installed: boolean) {
  const root = document.documentElement;
  root.dataset.orbidocInstalled = installed ? 'true' : 'false';
  root.dataset.orbidocMobile = isMobileDevice() ? 'true' : 'false';
  markInstallTriggers();
}

export const InstallStateAgent: React.FC = () => {
  useEffect(() => {
    const hinted = localStorage.getItem(INSTALLED_HINT_KEY) === 'true';
    const sync = () => applyState(isStandalone() || (isMobileDevice() && localStorage.getItem(INSTALLED_HINT_KEY) === 'true'));
    if (hinted || isStandalone()) sync();
    else applyState(false);

    const onInstalled = () => {
      localStorage.setItem(INSTALLED_HINT_KEY, 'true');
      applyState(true);
    };
    const onInstallPrompt = () => {
      // Chrome fires beforeinstallprompt again after an uninstall; this clears a stale hint.
      if (!isStandalone()) localStorage.removeItem(INSTALLED_HINT_KEY);
      sync();
    };
    const displayQuery = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayChange = () => sync();
    displayQuery?.addEventListener?.('change', onDisplayChange);

    const observer = new MutationObserver(() => markInstallTriggers());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('beforeinstallprompt', onInstallPrompt as EventListener);
    window.addEventListener('resize', sync);

    return () => {
      observer.disconnect();
      displayQuery?.removeEventListener?.('change', onDisplayChange);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt as EventListener);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return <style>{`html[data-orbidoc-installed="true"][data-orbidoc-mobile="true"] .orbidoc-install-trigger{display:none!important}`}</style>;
};
