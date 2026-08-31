import {
  orbiDocDb,
  type LocalAssetRecord,
  type LocalDocumentRecord,
  type LocalEntityType,
  type LocalPdfRecord,
  type LocalSheetRecord,
  type SyncQueueRecord,
} from '../db/orbidocDb';

export const OFFLINE_AUTOSAVE_DELAY_MS = 800;

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function createDebouncedAutosave<T>(
  save: (value: T) => Promise<void> | void,
  delay = OFFLINE_AUTOSAVE_DELAY_MS,
) {
  let timer: number | undefined;
  let latest: T;
  let disposed = false;

  const flush = async () => {
    if (disposed) return;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    await save(latest);
  };

  return {
    schedule(value: T) {
      if (disposed) return;
      latest = value;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => void flush(), delay);
    },
    flush,
    dispose() {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    },
  };
}

const now = () => new Date().toISOString();

export async function saveDocumentLocal(record: Omit<LocalDocumentRecord, 'updatedAt'> & { updatedAt?: string }) {
  const next: LocalDocumentRecord = { ...record, updatedAt: record.updatedAt || now() };
  await orbiDocDb.documents.put(next);
  return next;
}

export async function saveSheetLocal(record: Omit<LocalSheetRecord, 'updatedAt'> & { updatedAt?: string }) {
  const next: LocalSheetRecord = { ...record, updatedAt: record.updatedAt || now() };
  await orbiDocDb.sheets.put(next);
  return next;
}

export async function savePdfLocal(record: Omit<LocalPdfRecord, 'updatedAt'> & { updatedAt?: string }) {
  const next: LocalPdfRecord = { ...record, updatedAt: record.updatedAt || now() };
  await orbiDocDb.pdf_store.put(next);
  return next;
}

export async function saveLocalAsset(record: Omit<LocalAssetRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }) {
  const stamp = now();
  const next: LocalAssetRecord = {
    ...record,
    createdAt: record.createdAt || stamp,
    updatedAt: record.updatedAt || stamp,
  };
  await orbiDocDb.assets.put(next);
  return next;
}

export async function listEntityAssets(entityType: LocalEntityType, entityId: string) {
  return orbiDocDb.assets.where('[entityType+entityId]').equals([entityType, entityId]).toArray();
}

export async function removeEntityAssets(entityType: LocalEntityType, entityId: string) {
  const keys = await orbiDocDb.assets.where('[entityType+entityId]').equals([entityType, entityId]).primaryKeys();
  await orbiDocDb.assets.bulkDelete(keys);
}

export async function enqueueSync(record: Omit<SyncQueueRecord, 'id' | 'timestamp' | 'attempts'> & Partial<Pick<SyncQueueRecord, 'id' | 'timestamp' | 'attempts'>>) {
  const key = record.id || `${record.provider}:${record.entityType}:${record.entityId}:${record.action}`;
  const existing = await orbiDocDb.sync_queue.get(key);
  const next: SyncQueueRecord = {
    ...existing,
    ...record,
    id: key,
    timestamp: record.timestamp || now(),
    attempts: record.attempts ?? existing?.attempts ?? 0,
  };
  await orbiDocDb.sync_queue.put(next);
  return next;
}

export async function markEntityModifiedOffline(entityType: LocalEntityType, entityId: string) {
  if (entityType === 'document') await orbiDocDb.documents.update(entityId, { isSynced: false, syncState: 'modified-offline', updatedAt: now() });
  else if (entityType === 'sheet') await orbiDocDb.sheets.update(entityId, { isSynced: false, syncState: 'modified-offline', updatedAt: now() });
  else await orbiDocDb.pdf_store.update(entityId, { isSynced: false, syncState: 'modified-offline', updatedAt: now() });
}

export async function markEntitySyncState(entityType: LocalEntityType, entityId: string, syncState: 'synced' | 'syncing' | 'conflict' | 'error', metadata?: { driveVersion?: string; driveModifiedTime?: string }) {
  const patch = {
    syncState,
    isSynced: syncState === 'synced',
    ...(metadata || {}),
  };
  if (entityType === 'document') await orbiDocDb.documents.update(entityId, patch);
  else if (entityType === 'sheet') await orbiDocDb.sheets.update(entityId, patch);
  else await orbiDocDb.pdf_store.update(entityId, patch);
}

export async function deleteLocalEntity(entityType: LocalEntityType, entityId: string) {
  await orbiDocDb.transaction('rw', orbiDocDb.documents, orbiDocDb.sheets, orbiDocDb.pdf_store, orbiDocDb.assets, async () => {
    if (entityType === 'document') await orbiDocDb.documents.delete(entityId);
    else if (entityType === 'sheet') await orbiDocDb.sheets.delete(entityId);
    else await orbiDocDb.pdf_store.delete(entityId);
    await removeEntityAssets(entityType, entityId);
  });
}
