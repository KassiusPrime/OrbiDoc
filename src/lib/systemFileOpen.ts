import type { OrbiDocFileOrigin, OrbiDocFileSource } from '../types';

export const ORBIDOC_OPEN_FILE_EVENT = 'orbidoc:open-file';

export type OrbiDocOpenFileDetail = {
  file: File;
  source?: OrbiDocFileSource;
  origin?: Partial<OrbiDocFileOrigin>;
};

export function openFileInsideOrbiDoc(
  file: File,
  source: OrbiDocOpenFileDetail['source'] = 'local',
  origin?: OrbiDocOpenFileDetail['origin'],
) {
  window.dispatchEvent(new CustomEvent<OrbiDocOpenFileDetail>(ORBIDOC_OPEN_FILE_EVENT, { detail: { file, source, origin } }));
}
