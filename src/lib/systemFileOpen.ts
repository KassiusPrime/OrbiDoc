import type { OrbiDocFileOrigin, OrbiDocFileSource } from '../types';

export const ORBIDOC_OPEN_FILE_EVENT = 'orbidoc:open-file';

export type OrbiDocOpenFileDetail = {
  file: File;
  source?: OrbiDocFileSource;
  origin?: Partial<OrbiDocFileOrigin>;
};

const fileOrigins = new WeakMap<File, Partial<OrbiDocFileOrigin>>();

export function bindOrbiDocFileOrigin(file: File, origin: Partial<OrbiDocFileOrigin>) {
  fileOrigins.set(file, origin);
  return file;
}

export function readOrbiDocFileOrigin(file: File) {
  return fileOrigins.get(file);
}

export function openFileInsideOrbiDoc(
  file: File,
  source: OrbiDocOpenFileDetail['source'] = 'local',
  origin?: OrbiDocOpenFileDetail['origin'],
) {
  const boundOrigin = origin || readOrbiDocFileOrigin(file);
  window.dispatchEvent(new CustomEvent<OrbiDocOpenFileDetail>(ORBIDOC_OPEN_FILE_EVENT, { detail: { file, source, origin: boundOrigin } }));
}
