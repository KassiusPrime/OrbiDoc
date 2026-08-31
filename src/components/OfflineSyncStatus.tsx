import React, { useEffect, useState } from 'react';
import { IconAlertTriangle as AlertTriangle, IconCloudCheck as CloudCheck, IconCloudOff as CloudOff, IconRefresh as Refresh } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { orbiDocDb } from '../db/orbidocDb';
import { flushDriveSyncQueue } from '../services/driveSyncQueue';

export const OfflineSyncStatus: React.FC = () => {
  const pending = useLiveQuery(() => orbiDocDb.sync_queue.count(), [], 0) ?? 0;
  const conflicts = useLiveQuery(
    async () => (await orbiDocDb.sync_queue.toArray()).filter((item) => (item.lastError || '').startsWith('CONFLICT:')).length,
    [],
    0,
  ) ?? 0;
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online && pending === 0 && conflicts === 0) return null;

  const label = conflicts
    ? `${conflicts} conflito(s) aguardando resolução`
    : !online
      ? pending ? `Modificado offline · ${pending} pendente(s)` : 'Offline · salvo localmente'
      : `${pending} alteração(ões) aguardando sincronização`;

  const Icon = conflicts ? AlertTriangle : online ? CloudCheck : CloudOff;

  return (
    <div className={`orbidoc-offline-sync-status ${conflicts ? 'has-conflict' : ''}`} role="status" aria-live="polite">
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
      {online && pending > 0 && !conflicts ? (
        <button
          type="button"
          onClick={async () => {
            setSyncing(true);
            try { await flushDriveSyncQueue(); } finally { setSyncing(false); }
          }}
          disabled={syncing}
          className="orbidoc-compact-control w-6 h-6 rounded-md inline-flex items-center justify-center disabled:opacity-50"
          aria-label="Sincronizar agora"
        >
          <Refresh className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
        </button>
      ) : null}
    </div>
  );
};
