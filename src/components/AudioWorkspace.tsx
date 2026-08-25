import React, { useState } from 'react';
import { IconPlayerPlay as Play, IconMicrophone as Microphone } from '@tabler/icons-react';
import { AudioWorkspaceLegacy, type AudioWorkspaceLegacyProps } from './AudioWorkspaceLegacy';
import { MediaPlayerWorkspace } from './MediaPlayerWorkspace';

type MediaArea = 'player' | 'voice';

export const AudioWorkspace: React.FC<AudioWorkspaceLegacyProps> = (props) => {
  const [area, setArea] = useState<MediaArea>('player');
  return <div className="orbidoc-media-shell space-y-4">
    <div className="orbidoc-product-tabs inline-flex max-w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-sm">
      <button onClick={() => setArea('player')} className={`h-10 px-4 rounded-xl text-xs font-black inline-flex items-center gap-2 whitespace-nowrap ${area === 'player' ? 'bg-[#3157F6] text-white shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Play className="w-4 h-4" /> Player & vídeo</button>
      <button onClick={() => setArea('voice')} className={`h-10 px-4 rounded-xl text-xs font-black inline-flex items-center gap-2 whitespace-nowrap ${area === 'voice' ? 'bg-[#3157F6] text-white shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Microphone className="w-4 h-4" /> Voz & transcrição</button>
    </div>
    {area === 'player' ? <MediaPlayerWorkspace showNotification={props.showNotification} /> : <AudioWorkspaceLegacy {...props} />}
  </div>;
};
