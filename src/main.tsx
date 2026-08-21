import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './AppV5';
import { AccountSyncAgent } from './components/AccountSyncAgent';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AiRuntimeStatus } from './components/AiRuntimeStatus';
import { MediaToolsLauncher } from './components/MediaToolsLauncher';
import { OrbiDocExperienceShell } from './components/OrbiDocExperienceShell';
import { QuickScanReaderLauncher } from './components/QuickScanReaderLauncher';
import { SystemFileOpenAgent } from './components/SystemFileOpenAgent';
import { VersionHistoryLauncher } from './components/VersionHistoryLauncher';
import { migrateLegacyBrandStorage } from './lib/legacyBrandMigration';
import { applyOrbiDocPlatformProfile } from './lib/platformProfile';
import { mountPwaInstallStateAgent } from './lib/pwaInstall';
import './index.css';
import './orbidoc-ui.css';
import './platform.css';
import './scan-reader.css';

migrateLegacyBrandStorage();
applyOrbiDocPlatformProfile();
mountPwaInstallStateAgent();

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('OrbiDoc service worker registration failed:', error);
  },
});

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
    </AppErrorBoundary>
  </React.StrictMode>
);
