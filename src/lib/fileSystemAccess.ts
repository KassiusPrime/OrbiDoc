import { saveAs } from 'file-saver';

export interface OrbiDocFilePickerType {
  description?: string;
  accept: Record<string, string[]>;
}

export interface OrbiDocFileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<{
    write(data: Blob | ArrayBuffer | ArrayBufferView | string): Promise<void>;
    close(): Promise<void>;
    abort?(): Promise<void>;
  }>;
  queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
}

type PickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: OrbiDocFilePickerType[];
  }) => Promise<OrbiDocFileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    excludeAcceptAllOption?: boolean;
    types?: OrbiDocFilePickerType[];
  }) => Promise<OrbiDocFileSystemFileHandle>;
};

const pickerWindow = () => window as PickerWindow;

export function supportsFileSystemAccess() {
  return Boolean(pickerWindow().showOpenFilePicker && pickerWindow().showSaveFilePicker && window.isSecureContext);
}

export async function requestReadWritePermission(handle: OrbiDocFileSystemFileHandle) {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  const current = await handle.queryPermission({ mode: 'readwrite' });
  if (current === 'granted') return true;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}

export async function pickLocalFile(types?: OrbiDocFilePickerType[]) {
  const picker = pickerWindow().showOpenFilePicker;
  if (!picker) return null;
  const handles = await picker({ multiple: false, types, excludeAcceptAllOption: false });
  const handle = handles[0];
  if (!handle) return null;
  return { handle, file: await handle.getFile() };
}

export async function writeBlobToHandle(handle: OrbiDocFileSystemFileHandle, data: Blob | ArrayBuffer | string) {
  const allowed = await requestReadWritePermission(handle);
  if (!allowed) throw new Error('Permissão de escrita no arquivo foi recusada.');
  const writable = await handle.createWritable({ keepExistingData: false });
  try {
    await writable.write(data);
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => undefined);
    throw error;
  }
  return handle;
}

export async function saveLocalFile(
  data: Blob | ArrayBuffer | string,
  options: {
    suggestedName: string;
    mimeType?: string;
    extensions?: string[];
    existingHandle?: OrbiDocFileSystemFileHandle | null;
    preferPicker?: boolean;
  },
) {
  const blob = data instanceof Blob
    ? data
    : new Blob([data], { type: options.mimeType || 'application/octet-stream' });

  if (options.existingHandle) {
    await writeBlobToHandle(options.existingHandle, blob);
    return { handle: options.existingHandle, method: 'overwrite' as const };
  }

  const picker = pickerWindow().showSaveFilePicker;
  if (options.preferPicker !== false && picker && window.isSecureContext) {
    const handle = await picker({
      suggestedName: options.suggestedName,
      types: options.mimeType && options.extensions?.length
        ? [{ description: options.suggestedName, accept: { [options.mimeType]: options.extensions } }]
        : undefined,
    });
    await writeBlobToHandle(handle, blob);
    return { handle, method: 'picker' as const };
  }

  saveAs(blob, options.suggestedName);
  return { handle: null, method: 'download' as const };
}

export async function fileHandleToFile(handle: OrbiDocFileSystemFileHandle) {
  return handle.getFile();
}
