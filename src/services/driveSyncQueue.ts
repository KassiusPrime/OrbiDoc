import { orbiDocDb, type LocalEntityType, type SyncQueueRecord } from '../db/orbidocDb';
import { getStoredGoogleUser, updateGoogleDriveFile } from './googleAuthDrive';
import { enqueueSync, markEntityModifiedOffline, markEntitySyncState } from './offlinePersistence';

export interface SyncQueueSummary {
  pending: number;
  conflicts: number;
  errors: number;
  syncing: boolean;
  lastRunAt?: string;
}

let running: Promise<SyncQueueSummary> | null = null;
let lastRunAt = '';

async function localDriveMetadata(entityType: LocalEntityType, entityId: string) {
  if (entityType === 'document') return orbiDocDb.documents.get(entityId);
  if (entityType === 'sheet') return orbiDocDb.sheets.get(entityId);
  return orbiDocDb.pdf_store.get(entityId);
}

export async function queueGoogleDriveEntitySync(entityType: LocalEntityType, entityId: string) {
  const record = await localDriveMetadata(entityType, entityId);
  if (!record?.driveFileId) return false;
  await enqueueSync({
    action: 'upsert',
    entityType,
    entityId,
    provider: 'googleDrive',
    expectedDriveVersion: record.driveVersion,
  });
  if (!navigator.onLine) await markEntityModifiedOffline(entityType, entityId);
  else queueMicrotask(() => void flushDriveSyncQueue());
  return true;
}

const dispatch = (summary: SyncQueueSummary) => {
  window.dispatchEvent(new CustomEvent<SyncQueueSummary>('orbidoc:sync-status', { detail: summary }));
};

async function entityPayload(item: SyncQueueRecord): Promise<{ blob: Blob; mimeType: string; fileName: string; driveFileId: string } | null> {
  if (item.entityType === 'document') {
    const record = await orbiDocDb.documents.get(item.entityId);
    if (!record?.driveFileId) return null;
    const blob = record.rawBlob || new Blob([JSON.stringify(record.contentJSON)], { type: record.mimeType || 'application/json' });
    return { blob, mimeType: blob.type || record.mimeType || 'application/octet-stream', fileName: record.fileName || `${record.title}.orbidoc.json`, driveFileId: record.driveFileId };
  }
  if (item.entityType === 'sheet') {
    const record = await orbiDocDb.sheets.get(item.entityId);
    if (!record?.driveFileId) return null;
    const blob = record.rawBlob || new Blob([JSON.stringify(record.workbookData)], { type: record.mimeType || 'application/json' });
    return { blob, mimeType: blob.type || record.mimeType || 'application/octet-stream', fileName: record.fileName || `${record.title}.orbidoc-sheet.json`, driveFileId: record.driveFileId };
  }
  const record = await orbiDocDb.pdf_store.get(item.entityId);
  if (!record?.driveFileId) return null;
  return { blob: record.pdfBlob, mimeType: record.pdfBlob.type || 'application/pdf', fileName: record.fileName || `${record.title}.pdf`, driveFileId: record.driveFileId };
}

async function removeQueueForEntity(entityType: LocalEntityType, entityId: string) {
  const keys = await orbiDocDb.sync_queue.where('[entityType+entityId]').equals([entityType, entityId]).primaryKeys();
  await orbiDocDb.sync_queue.bulkDelete(keys);
}

export async function getSyncQueueSummary(syncing = Boolean(running)): Promise<SyncQueueSummary> {
  const rows = await orbiDocDb.sync_queue.toArray();
  let conflicts = 0;
  let errors = 0;
  for (const row of rows) {
    if ((row.lastError || '').startsWith('CONFLICT:')) conflicts += 1;
    else if (row.lastError) errors += 1;
  }
  return { pending: rows.length, conflicts, errors, syncing, lastRunAt: lastRunAt || undefined };
}

async function processQueue(): Promise<SyncQueueSummary> {
  if (!navigator.onLine) return getSyncQueueSummary(false);
  const google = getStoredGoogleUser();
  if (!google) return getSyncQueueSummary(false);

  const queue = await orbiDocDb.sync_queue.orderBy('timestamp').toArray();
  for (const item of queue) {
    if (item.provider !== 'googleDrive') continue;
    if (item.action === 'delete') {
      await orbiDocDb.sync_queue.update(item.id, {
        attempts: item.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: 'DELETE_REMOTE_NOT_ENABLED: exclusão remota exige confirmação explícita.',
      });
      continue;
    }

    const payload = await entityPayload(item);
    if (!payload) {
      await orbiDocDb.sync_queue.delete(item.id);
      continue;
    }

    await markEntitySyncState(item.entityType, item.entityId, 'syncing');
    await orbiDocDb.sync_queue.update(item.id, {
      attempts: item.attempts + 1,
      lastAttemptAt: new Date().toISOString(),
      lastError: undefined,
    });

    try {
      const result = await updateGoogleDriveFile(google.accessToken, payload.driveFileId, payload.blob, {
        mimeType: payload.mimeType,
        fileName: payload.fileName,
        expectedVersion: item.expectedDriveVersion,
      });
      if (result.conflict) {
        await markEntitySyncState(item.entityType, item.entityId, 'conflict');
        await orbiDocDb.sync_queue.update(item.id, {
          lastError: `CONFLICT:${result.file.version || result.file.modifiedTime || 'remote-newer'}`,
        });
        continue;
      }

      await markEntitySyncState(item.entityType, item.entityId, 'synced', {
        driveVersion: result.file.version,
        driveModifiedTime: result.file.modifiedTime,
      });
      await removeQueueForEntity(item.entityType, item.entityId);
    } catch (error) {
      await markEntitySyncState(item.entityType, item.entityId, 'error');
      await orbiDocDb.sync_queue.update(item.id, {
        lastError: error instanceof Error ? error.message : 'Falha desconhecida na sincronização.',
      });
    }
  }

  lastRunAt = new Date().toISOString();
  return getSyncQueueSummary(false);
}

export async function flushDriveSyncQueue() {
  if (running) return running;
  running = (async () => {
    dispatch(await getSyncQueueSummary(true));
    try {
      return await processQueue();
    } finally {
      running = null;
      dispatch(await getSyncQueueSummary(false));
    }
  })();
  return running;
}

export function installDriveSyncQueueAgent() {
  const run = () => void flushDriveSyncQueue();
  const announceOffline = () => void getSyncQueueSummary(false).then(dispatch);
  window.addEventListener('online', run);
  window.addEventListener('offline', announceOffline);
  window.addEventListener('orbidoc:sync-request', run as EventListener);
  if (navigator.onLine) queueMicrotask(run);
  return () => {
    window.removeEventListener('online', run);
    window.removeEventListener('offline', announceOffline);
    window.removeEventListener('orbidoc:sync-request', run as EventListener);
  };
}
