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
    let navResizeObserver: ResizeObserver | null = null;

    const syncBottomNav = () => {
      const nav = document.querySelector<HTMLElement>('.orbidoc-bottom-nav, nav[aria-label="Navegação principal"]');
      if (!nav) return;
      const height = Math.max(0, Math.round(nav.getBoundingClientRect().height));
      if (height) root.style.setProperty('--orbidoc-bottom-nav-height', `${height}px`);
    };

    const syncViewport = () => {
      const viewport = window.visualViewport;
      const layoutHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
      const layoutWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
      const visibleHeight = Math.max(1, viewport?.height || layoutHeight);
      const visibleWidth = Math.max(1, viewport?.width || layoutWidth);
      const offsetTop = Math.max(0, viewport?.offsetTop || 0);
      const offsetLeft = Math.max(0, viewport?.offsetLeft || 0);
      const visualRightInset = Math.max(0, layoutWidth - visibleWidth - offsetLeft);
      const hiddenBottom = Math.max(0, layoutHeight - visibleHeight - offsetTop);
      const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      const virtualKeyboard = (navigator as Navigator & { virtualKeyboard?: { boundingRect?: DOMRectReadOnly } }).virtualKeyboard;
      const virtualKeyboardHeight = Math.max(0, Math.round(virtualKeyboard?.boundingRect?.height || 0));
      const keyboardInset = Math.max(hiddenBottom, virtualKeyboardHeight);
      const keyboardOpen = keyboardInset >= Math.max(120, layoutHeight * 0.18);

      root.style.setProperty('--orbidoc-visual-height', `${Math.round(visibleHeight)}px`);
      root.style.setProperty('--orbidoc-visual-width', `${Math.round(visibleWidth)}px`);
      root.style.setProperty('--orbidoc-visual-offset-top', `${Math.round(offsetTop)}px`);
      root.style.setProperty('--orbidoc-visual-offset-left', `${Math.round(offsetLeft)}px`);
      root.style.setProperty('--orbidoc-visual-right-inset', `${Math.round(visualRightInset)}px`);
      root.style.setProperty('--orbidoc-scrollbar-width', `${Math.round(scrollbarWidth)}px`);
      root.style.setProperty('--orbidoc-keyboard-inset', keyboardOpen ? `${Math.round(keyboardInset)}px` : '0px');
      root.dataset.orbidocKeyboard = keyboardOpen ? 'open' : 'closed';

      if (keyboardOpen) delete root.dataset.orbidocHardwareKeyboard;
      if (keyboardOpen !== lastKeyboard) {
        lastKeyboard = keyboardOpen;
        window.dispatchEvent(new CustomEvent('orbidoc:keyboard-visibility', { detail: { open: keyboardOpen, inset: keyboardInset } }));
      }
      syncBottomNav();
    };

    const revealFocusedControl = (event: FocusEvent) => {
      if (!editableTarget(event.target)) return;
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        const element = event.target instanceof HTMLElement ? event.target : null;
        if (!element || !document.contains(element)) return;
        const viewport = window.visualViewport;
        const visibleTop = (viewport?.offsetTop || 0) + 8;
        const visibleBottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - 8;
        const rect = element.getBoundingClientRect();
        if (rect.top < visibleTop || rect.bottom > visibleBottom) {
          element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
        }
      }, 120);
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
        hardwareTimer = window.setTimeout(() => { delete root.dataset.orbidocHardwareKeyboard; }, 1800);
      }
    };

    const clearHardwareKeyboardHint = () => {
      window.clearTimeout(hardwareTimer);
      delete root.dataset.orbidocHardwareKeyboard;
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
    document.addEventListener('focusout', clearHardwareKeyboardHint, true);
    window.addEventListener('keydown', protectPhysicalKeyboardEditing, true);

    const mutationObserver = new MutationObserver(() => {
      syncModalState();
      syncBottomNav();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal', 'class'] });

    if (typeof ResizeObserver !== 'undefined') {
      navResizeObserver = new ResizeObserver(syncBottomNav);
      const nav = document.querySelector<HTMLElement>('.orbidoc-bottom-nav, nav[aria-label="Navegação principal"]');
      if (nav) navResizeObserver.observe(nav);
    }

    root.dataset.orbidocViewportAgent = native ? 'native' : 'web';
    syncViewport();
    syncModalState();

    return () => {
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      document.removeEventListener('focusin', revealFocusedControl, true);
      document.removeEventListener('focusout', clearHardwareKeyboardHint, true);
      window.removeEventListener('keydown', protectPhysicalKeyboardEditing, true);
      mutationObserver.disconnect();
      navResizeObserver?.disconnect();
      window.clearTimeout(hardwareTimer);
      window.clearTimeout(focusTimer);
    };
  }, []);

  return null;
};
