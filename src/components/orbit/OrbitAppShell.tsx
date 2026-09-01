import React, { useEffect, useState } from 'react';

export interface OrbitAppShellProps {
  children: React.ReactNode;
}

/** Product-level boundary for shared Orbit accessibility/connectivity rules. */
export const OrbitAppShell: React.FC<OrbitAppShellProps> = ({ children }) => {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    document.documentElement.dataset.orbitShell = 'v2';
    const main = document.querySelector<HTMLElement>('main');
    const previousMainId = main?.id || '';
    if (main && !main.id) main.id = 'orbit-main-workspace';

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      delete document.documentElement.dataset.orbitShell;
      if (main?.id === 'orbit-main-workspace' && !previousMainId) main.removeAttribute('id');
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
