import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './AppV5';
import { AccountSyncAgent } from './components/AccountSyncAgent';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AiRuntimeStatus } from './components/AiRuntimeStatus';
import { MediaToolsLauncher } from './components/MediaToolsLauncher';
import { NativeAiSettingsLauncher } from './components/NativeAiSettingsLauncher';
import { OrbiDocExperienceShell } from './components/OrbiDocExperienceShell';
import { QuickScanReaderLauncher } from './components/QuickScanReaderLauncher';
import { SystemFileOpenAgent } from './components/SystemFileOpenAgent';
import { VersionHistoryLauncher } from './components/VersionHistoryLauncher';
import { migrateLegacyBrandStorage } from './lib/legacyBrandMigration';
import { installNativeAiApiBridge, installNativeFileOpenBridge } from './lib/nativeAndroidBridge';
import { applyOrbiDocNativeRuntimeProfile } from './lib/nativeRuntime';
import { applyOrbiDocPlatformProfile } from './lib/platformProfile';
import { mountPwaInstallStateAgent } from './lib/pwaInstall';
import './index.css';
import './orbidoc-ui.css';
import './orbidoc-motion.css';
import './orbidoc-native-ui.css';
import './platform.css';
import './scan-reader.css';

migrateLegacyBrandStorage();
const nativeRuntime = applyOrbiDocNativeRuntimeProfile();
if (nativeRuntime) {
  installNativeAiApiBridge();
  installNativeFileOpenBridge();
}
applyOrbiDocPlatformProfile();
mountPwaInstallStateAgent();

// Capacitor embeds dist/ inside the APK/AAB and serves it locally. Registering the
// PWA service worker there would add a second cache/boot layer with no benefit and
// could make a native build depend on stale web assets. Web/PWA keeps auto-update.
if (!nativeRuntime) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('OrbiDoc service worker registration failed:', error);
    },
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz do OrbiDoc não foi encontrado.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <OrbiDocExperienceShell>
        <App />
      </OrbiDocExperienceShell>
      <AccountSyncAgent />
      <SystemFileOpenAgent />
      <MediaToolsLauncher />
      <VersionHistoryLauncher />
      <QuickScanReaderLauncher />
      <AiRuntimeStatus />
      <NativeAiSettingsLauncher />
    </AppErrorBoundary>
  </React.StrictMode>
);