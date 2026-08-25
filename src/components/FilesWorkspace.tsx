import React, { useState } from 'react';
import { IconFiles as Files, IconFileZip as FileZip } from '@tabler/icons-react';
import { SavedProject } from '../types';
import { ArchiveFileManager } from './ArchiveFileManager';
import { ProjectLibraryWorkspace } from './ProjectLibraryWorkspace';

interface FilesWorkspaceProps {
  projects: SavedProject[];
  onOpenProject: (project: SavedProject) => void;
  onCreateProject: (type: SavedProject['type']) => void;
  onUpdateProject: (project: SavedProject) => void;
  onDeleteProject: (id: string) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

type FileArea = 'projects' | 'device';

export const FilesWorkspace: React.FC<FilesWorkspaceProps> = (props) => {
  const [area, setArea] = useState<FileArea>('projects');
  return <div className="orbidoc-files-shell space-y-4">
    <div className="orbidoc-product-tabs inline-flex max-w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-sm">
      <button onClick={() => setArea('projects')} className={`h-10 px-4 rounded-xl text-xs font-black inline-flex items-center gap-2 whitespace-nowrap ${area === 'projects' ? 'bg-[#3157F6] text-white shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Files className="w-4 h-4" /> Projetos OrbiDoc</button>
      <button onClick={() => setArea('device')} className={`h-10 px-4 rounded-xl text-xs font-black inline-flex items-center gap-2 whitespace-nowrap ${area === 'device' ? 'bg-[#3157F6] text-white shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><FileZip className="w-4 h-4" /> Dispositivo & ZIP</button>
    </div>
    {area === 'projects' ? <ProjectLibraryWorkspace {...props} /> : <ArchiveFileManager showNotification={props.showNotification} />}
  </div>;
};
