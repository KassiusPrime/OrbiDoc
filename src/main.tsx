import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './AppV5';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AiRuntimeStatus } from './components/AiRuntimeStatus';
import { OrbiDocExperienceShell } from './components/OrbiDocExperienceShell';
import { QuickScanReaderLauncher } from './components/QuickScanReaderLauncher';
import { migrateLegacyBrandStorage } from './lib/legacyBrandMigration';
import { applyOrbiDocPlatformProfile } from './lib/platformProfile';
import './index.css';
import './orbidoc-ui.css';
import './platform.css';
import './scan-reader.css';

migrateLegacyBrandStorage();
applyOrbiDocPlatformProfile();

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
      <QuickScanReaderLauncher />
      <AiRuntimeStatus />
    </AppErrorBoundary>
  </React.StrictMode>
);
