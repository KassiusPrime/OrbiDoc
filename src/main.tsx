import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AiRuntimeStatus } from './components/AiRuntimeStatus';
import './index.css';

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('DocSwiss service worker registration failed:', error);
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <AiRuntimeStatus />
  </React.StrictMode>
);
