import { saveAs } from 'file-saver';

export type WorkspaceBackup = {
  product: 'OrbiDoc';
  version: 1;
  createdAt: string;
  entries: Record<string, string>;
};

const BACKUP_PREFIXES = ['orbidoc_'];

const isWorkspaceKey = (key: string) => BACKUP_PREFIXES.some((prefix) => key.startsWith(prefix));

export function collectWorkspaceBackup(): WorkspaceBackup {
  const entries: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !isWorkspaceKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) entries[key] = value;
  }
  return {
    product: 'OrbiDoc',
    version: 1,
    createdAt: new Date().toISOString(),
    entries,
  };
}

export function downloadWorkspaceBackup() {
  const backup = collectWorkspaceBackup();
  const date = backup.createdAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  saveAs(blob, `OrbiDoc-backup-${date}.json`);
  return Object.keys(backup.entries).length;
}

export async function readWorkspaceBackup(file: File): Promise<WorkspaceBackup> {
  if (file.size > 80 * 1024 * 1024) throw new Error('O backup excede 80 MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('O arquivo não contém um backup JSON válido.');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Backup inválido.');
  const backup = parsed as Partial<WorkspaceBackup>;
  if (backup.product !== 'OrbiDoc' || backup.version !== 1 || !backup.entries || typeof backup.entries !== 'object') throw new Error('Este arquivo não é um backup OrbiDoc compatível.');
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(backup.entries)) {
    if (!isWorkspaceKey(key) || typeof value !== 'string') continue;
    entries[key] = value;
  }
  return {
    product: 'OrbiDoc',
    version: 1,
    createdAt: typeof backup.createdAt === 'string' ? backup.createdAt : new Date().toISOString(),
    entries,
  };
}

export function restoreWorkspaceBackup(backup: WorkspaceBackup) {
  const keys = Object.keys(backup.entries);
  if (!keys.length) throw new Error('O backup não contém dados do workspace.');
  for (const [key, value] of Object.entries(backup.entries)) localStorage.setItem(key, value);
  return keys.length;
}
