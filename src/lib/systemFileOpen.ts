export const ORBIDOC_OPEN_FILE_EVENT = 'orbidoc:open-file';

export type OrbiDocOpenFileDetail = {
  file: File;
  source?: 'local' | 'google-drive' | 'onedrive' | 'github' | 'share' | 'system';
};

export function openFileInsideOrbiDoc(file: File, source: OrbiDocOpenFileDetail['source'] = 'local') {
  window.dispatchEvent(new CustomEvent<OrbiDocOpenFileDetail>(ORBIDOC_OPEN_FILE_EVENT, { detail: { file, source } }));
}
