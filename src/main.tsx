import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './AppV5';
import { AccountSyncAgent } from './components/AccountSyncAgent';
import { AdvancedFreeToolsLauncher } from './components/AdvancedFreeToolsLauncher';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AiRuntimeStatus } from './components/AiRuntimeStatus';
import { GitHubProjectsWorkspace } from './components/GitHubProjectsWorkspace';
import { ImageResizeLauncher } from './components/ImageResizeLauncher';
import { LocalUtilitiesLauncher } from './components/LocalUtilitiesLauncher';
import { MediaToolsLauncher } from './components/MediaToolsLauncher';
import { NativeAiSettingsLauncher } from './components/NativeAiSettingsLauncher';
import { NativeViewportAgent } from './components/NativeViewportAgent';
import { OrbiDocExperienceShell } from './components/OrbiDocExperienceShell';
import { OrbiDocLoginScreen } from './components/OrbiDocLoginScreen';
import { QuickScanReaderLauncher } from './components/QuickScanReaderLauncher';
import { SystemFileOpenAgent } from './components/SystemFileOpenAgent';
import { VersionHistoryLauncher } from './components/VersionHistoryLauncher';
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
import './platform-surfaces.css';
import './orbidoc-overlay-safety.css';
import './orbidoc-layout-safety-v2.css';
import './orbidoc-product-polish.css';
import './scan-reader.css';

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
      <AccountSyncAgent />
      <SystemFileOpenAgent />
      <GitHubProjectsWorkspace />
      <MediaToolsLauncher />
      <VersionHistoryLauncher />
      <QuickScanReaderLauncher />
      <AiRuntimeStatus />
      <NativeAiSettingsLauncher />
      <LocalUtilitiesLauncher />
      <AdvancedFreeToolsLauncher />
      <ImageResizeLauncher />
    </AppErrorBoundary>
  </React.StrictMode>
);
