import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './AppV6';
import { AccountSyncAgent } from './components/AccountSyncAgent';
import { AdvancedFreeToolsLauncher } from './components/AdvancedFreeToolsLauncher';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ImageResizeLauncher } from './components/ImageResizeLauncher';
import { LocalUtilitiesLauncher } from './components/LocalUtilitiesLauncher';
import { MediaToolsLauncher } from './components/MediaToolsLauncher';
import { NativeAiSettingsLauncher } from './components/NativeAiSettingsLauncher';
import { NativeFileSaveAgent } from './components/NativeFileSaveAgent';
import { NativeViewportAgent } from './components/NativeViewportAgent';
import { OrbiDocExperienceShell } from './components/OrbiDocExperienceShell';
import { OrbiDocLoginScreen } from './components/OrbiDocLoginScreen';
import { QuickScanReaderLauncher } from './components/QuickScanReaderLauncher';
import { SystemFileOpenAgent } from './components/SystemFileOpenAgent';
import { VersionHistoryLauncher } from './components/VersionHistoryLauncher';
import { WorkspaceFileSessionAgent } from './components/WorkspaceFileSessionAgent';
import { installAiInternetAgent } from './lib/aiInternet';
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
import './orbidoc-overlay-safety.css';
import './orbidoc-layout-safety-v2.css';
import './orbidoc-product-polish.css';
import './scan-reader.css';
import './orbidoc-adaptive-shell.css';
import './orbidoc-creator-ui.css';

migrateLegacyBrandStorage();
const nativeRuntime = applyOrbiDocNativeRuntimeProfile();
if (nativeRuntime) {
  installNativeAiApiBridge();
  installNativeFileOpenBridge();
}
installAiInternetAgent();
applyOrbiDocPlatformProfile();
mountPwaInstallStateAgent();

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
      <OrbiDocLoginScreen />
      <NativeViewportAgent />
      <NativeFileSaveAgent />
      <AccountSyncAgent />
      <WorkspaceFileSessionAgent />
      <SystemFileOpenAgent />

      {/* Controllers remain mounted for event/keyboard compatibility. Their legacy
          floating triggers are hidden by the adaptive shell and surfaced only from
          Apps/Settings when contextually useful. */}
      <MediaToolsLauncher />
      <VersionHistoryLauncher />
      <QuickScanReaderLauncher />
      <NativeAiSettingsLauncher />
      <LocalUtilitiesLauncher />
      <AdvancedFreeToolsLauncher />
      <ImageResizeLauncher />
    </AppErrorBoundary>
  </React.StrictMode>
);
