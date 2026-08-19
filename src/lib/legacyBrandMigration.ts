const PREFIXES: Array<[string, string]> = [
  ['docswiss_', 'orbidoc_'],
  ['docplus_', 'orbidoc_'],
];

function migrateStorage(storage: Storage) {
  const entries: Array<[string, string]> = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    const match = PREFIXES.find(([legacy]) => key.startsWith(legacy));
    if (!match) continue;
    const [legacy, current] = match;
    const nextKey = current + key.slice(legacy.length);
    if (storage.getItem(nextKey) == null) {
      const value = storage.getItem(key);
      if (value != null) entries.push([nextKey, value]);
    }
  }
  for (const [key, value] of entries) storage.setItem(key, value);
}

export function migrateLegacyBrandStorage() {
  if (typeof window === 'undefined') return;
  try { migrateStorage(window.localStorage); } catch {}
  try { migrateStorage(window.sessionStorage); } catch {}
}
