import Dexie, { type EntityTable } from 'dexie';

export type LocalEntityType = 'document' | 'sheet' | 'pdf';
export type SyncProvider = 'googleDrive';
export type SyncAction = 'upsert' | 'delete';
export type SyncState = 'local' | 'synced' | 'modified-offline' | 'conflict' | 'syncing' | 'error';

export interface LocalDocumentRecord {
  id: string;
  title: string;
  contentJSON: unknown;
  rawBlob?: Blob;
  updatedAt: string;
  driveFileId?: string;
  driveVersion?: string;
  driveModifiedTime?: string;
  isSynced: boolean;
  syncState?: SyncState;
  fileName?: string;
  mimeType?: string;
}

export interface LocalSheetRecord {
  id: string;
  title: string;
  workbookData: unknown;
  rawBlob?: Blob;
  updatedAt: string;
  driveFileId?: string;
  driveVersion?: string;
  driveModifiedTime?: string;
  isSynced: boolean;
  syncState?: SyncState;
  fileName?: string;
  mimeType?: string;
}

export interface LocalPdfRecord {
  id: string;
  title: string;
  pdfBlob: Blob;
  annotationsJSON: unknown;
  updatedAt: string;
  driveFileId?: string;
  driveVersion?: string;
  driveModifiedTime?: string;
  isSynced?: boolean;
  syncState?: SyncState;
  fileName?: string;
}

export interface SyncQueueRecord {
  id: string;
  action: SyncAction;
  entityType: LocalEntityType;
  entityId: string;
  provider: SyncProvider;
  payload?: unknown;
  timestamp: string;
  expectedDriveVersion?: string;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
}

export interface LocalAssetRecord {
  id: string;
  entityId: string;
  entityType: LocalEntityType;
  name: string;
  mimeType: string;
  blob: Blob;
  createdAt: string;
  updatedAt: string;
}

export class OrbiDocDatabase extends Dexie {
  documents!: EntityTable<LocalDocumentRecord, 'id'>;
  sheets!: EntityTable<LocalSheetRecord, 'id'>;
  pdf_store!: EntityTable<LocalPdfRecord, 'id'>;
  sync_queue!: EntityTable<SyncQueueRecord, 'id'>;
  assets!: EntityTable<LocalAssetRecord, 'id'>;

  constructor() {
    super('OrbiDocWorkspace');

    this.version(1).stores({
      documents: '&id, title, updatedAt, driveFileId, isSynced, syncState',
      sheets: '&id, title, updatedAt, driveFileId, isSynced, syncState',
      pdf_store: '&id, title, updatedAt, driveFileId, isSynced, syncState',
      sync_queue: '&id, [provider+timestamp], [entityType+entityId], timestamp, action, attempts',
      assets: '&id, [entityType+entityId], entityId, createdAt, updatedAt',
    });
  }
}

export const orbiDocDb = new OrbiDocDatabase();

export async function clearOrbiDocLocalDatabase() {
  await orbiDocDb.transaction(
    'rw',
    orbiDocDb.documents,
    orbiDocDb.sheets,
    orbiDocDb.pdf_store,
    orbiDocDb.sync_queue,
    orbiDocDb.assets,
    async () => {
      await Promise.all([
        orbiDocDb.documents.clear(),
        orbiDocDb.sheets.clear(),
        orbiDocDb.pdf_store.clear(),
        orbiDocDb.sync_queue.clear(),
        orbiDocDb.assets.clear(),
      ]);
    },
  );
}
