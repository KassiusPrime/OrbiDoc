import React, { useEffect } from 'react';
import { isOrbiDocNativeRuntime } from '../lib/nativeRuntime';

const GLOBAL_SHORTCUTS = new Set(['m', 'o', 'h', 'k']);

function editableTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  return Boolean(
    element.isContentEditable
    || element.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
  );
}

export const NativeViewportAgent: React.FC = () => {
  useEffect(() => {
    const root = document.documentElement;
    const native = isOrbiDocNativeRuntime();
    let lastKeyboard = false;
    let hardwareTimer = 0;
    let focusTimer = 0;

    const syncViewport = () => {
      const viewport = window.visualViewport;
      const layoutHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
      const visibleHeight = Math.max(1, viewport?.height || layoutHeight);
      const offsetTop = Math.max(0, viewport?.offsetTop || 0);
      const hiddenBottom = Math.max(0, layoutHeight - visibleHeight - offsetTop);
      const keyboardOpen = hiddenBottom >= Math.max(120, layoutHeight * 0.18);

      root.style.setProperty('--orbidoc-visual-height', `${Math.round(visibleHeight)}px`);
      root.style.setProperty('--orbidoc-visual-offset-top', `${Math.round(offsetTop)}px`);
      root.style.setProperty('--orbidoc-keyboard-inset', keyboardOpen ? `${Math.round(hiddenBottom)}px` : '0px');
      root.dataset.orbidocKeyboard = keyboardOpen ? 'open' : 'closed';

      if (keyboardOpen !== lastKeyboard) {
        lastKeyboard = keyboardOpen;
        window.dispatchEvent(new CustomEvent('orbidoc:keyboard-visibility', { detail: { open: keyboardOpen, inset: hiddenBottom } }));
      }
    };

    const revealFocusedControl = (event: FocusEvent) => {
      if (!editableTarget(event.target)) return;
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        const element = event.target instanceof HTMLElement ? event.target : null;
        element?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }, 180);
    };

    const protectPhysicalKeyboardEditing = (event: KeyboardEvent) => {
      const editing = editableTarget(event.target);
      if (!editing) return;

      const shortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && GLOBAL_SHORTCUTS.has(event.key.toLowerCase());
      if (shortcut) {
        // Global OrbiDoc shortcuts must never steal keystrokes from an editor/input.
        event.stopImmediatePropagation();
        return;
      }

      if (root.dataset.orbidocKeyboard !== 'open') {
        root.dataset.orbidocHardwareKeyboard = 'true';
        window.clearTimeout(hardwareTimer);
        hardwareTimer = window.setTimeout(() => { delete root.dataset.orbidocHardwareKeyboard; }, 1500);
      }
    };

    const syncModalState = () => {
      const modal = document.querySelector('[aria-modal="true"]');
      root.dataset.orbidocModal = modal ? 'open' : 'closed';
    };

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    document.addEventListener('focusin', revealFocusedControl, true);
    window.addEventListener('keydown', protectPhysicalKeyboardEditing, true);

    const observer = new MutationObserver(syncModalState);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal'] });

    root.dataset.orbidocViewportAgent = native ? 'native' : 'web';
    syncViewport();
    syncModalState();

    return () => {
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      document.removeEventListener('focusin', revealFocusedControl, true);
      window.removeEventListener('keydown', protectPhysicalKeyboardEditing, true);
      observer.disconnect();
      window.clearTimeout(hardwareTimer);
      window.clearTimeout(focusTimer);
    };
  }, []);

  return null;
};
