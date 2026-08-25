type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

declare global {
  interface Window {
    Capacitor?: CapacitorBridge;
  }
}

export function isOrbiDocNativeRuntime() {
  if (typeof window === 'undefined') return false;
  const bridge = window.Capacitor;
  if (!bridge) return false;
  try {
    if (bridge.isNativePlatform?.()) return true;
    return bridge.getPlatform?.() === 'android' || bridge.getPlatform?.() === 'ios';
  } catch {
    return false;
  }
}

export function getOrbiDocNativePlatform(): 'android' | 'ios' | null {
  if (!isOrbiDocNativeRuntime()) return null;
  const platform = window.Capacitor?.getPlatform?.();
  return platform === 'android' || platform === 'ios' ? platform : null;
}

export function applyOrbiDocNativeRuntimeProfile() {
  const native = isOrbiDocNativeRuntime();
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.orbidocNative = native ? 'true' : 'false';
    const platform = getOrbiDocNativePlatform();
    if (platform) document.documentElement.dataset.orbidocNativePlatform = platform;
    else delete document.documentElement.dataset.orbidocNativePlatform;
  }
  return native;
}

/**
 * Native builds embed the entire Vite dist directory in the APK/AAB. Keeping this
 * helper centralized prevents web-only concerns (PWA install/service worker) from
 * becoming dependencies of the Android shell.
 */
export function nativeAssetUrl(path: string) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean;
}
