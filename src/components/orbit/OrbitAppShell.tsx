import React, { useEffect, useState } from 'react';

export interface OrbitAppShellProps {
  children: React.ReactNode;
}

/**
 * Product-level shell boundary for Orbit.
 *
 * AppV5 still owns navigation while the migration is incremental, but every
 * surface now lives below a stable shell that centralizes accessibility,
 * connectivity state and visual-system hooks. Individual modules must not
 * recreate these product-level concerns.
 */
export const OrbitAppShell: React.FC<OrbitAppShellProps> = ({ children }) => {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    document.documentElement.dataset.orbitShell = 'v2';
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      delete document.documentElement.dataset.orbitShell;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <div className="orbit-app-shell" data-orbit-shell="v2" data-orbit-connectivity={online ? 'online' : 'offline'}>
      <a className="orbit-skip-link" href="#orbit-main-workspace">Pular para a área de trabalho</a>
      {!online ? (
        <div className="orbit-offline-banner" role="status" aria-live="polite">
          Offline · alterações locais continuam disponíveis; tarefas remotas do Nexus AI aguardam conexão.
        </div>
      ) : null}
      <div className="orbit-app-shell__content">{children}</div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {online ? 'Orbit conectado.' : 'Orbit offline.'}
      </div>
    </div>
  );
};
