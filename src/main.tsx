import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './AppV4';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AiRuntimeStatus } from './components/AiRuntimeStatus';
import './index.css';

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('DocSwiss service worker registration failed:', error);
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz do DocSwiss não foi encontrado.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
      <AiRuntimeStatus />
    </AppErrorBoundary>
  </React.StrictMode>
);
