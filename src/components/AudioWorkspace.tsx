import React, { useState } from 'react';
import { AudioLines, Clapperboard, Play } from 'lucide-react';
import { VoiceStudioWorkspace, type VoiceStudioWorkspaceProps } from './VoiceStudioWorkspace';
import { MediaPlayerWorkspace } from './MediaPlayerWorkspace';
import { VideoClipEditor } from './VideoClipEditor';

type MediaArea = 'player' | 'clip' | 'voice';

export const AudioWorkspace: React.FC<VoiceStudioWorkspaceProps> = (props) => {
  const [area, setArea] = useState<MediaArea>('player');
  return <div className="orbidoc-media-shell space-y-4">
    <div className="orbidoc-product-tabs inline-flex max-w-full overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
      <button onClick={() => setArea('player')} className={`h-10 px-4 rounded-xl text-xs font-black inline-flex items-center gap-2 whitespace-nowrap ${area === 'player' ? 'bg-[#3157F6] text-white shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Play className="w-4 h-4" /> Player</button>
      <button onClick={() => setArea('clip')} className={`h-10 px-4 rounded-xl text-xs font-black inline-flex items-center gap-2 whitespace-nowrap ${area === 'clip' ? 'bg-[#3157F6] text-white shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Clapperboard className="h-4 w-4" /> Cortar vídeo</button>
      <button onClick={() => setArea('voice')} className={`h-10 px-4 rounded-xl text-xs font-black inline-flex items-center gap-2 whitespace-nowrap ${area === 'voice' ? 'bg-[#3157F6] text-white shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><AudioLines className="h-4 w-4" /> Voz & transcrição</button>
    </div>
    {area === 'player' ? <MediaPlayerWorkspace showNotification={props.showNotification} /> : area === 'clip' ? <VideoClipEditor showNotification={props.showNotification} /> : <VoiceStudioWorkspace {...props} />}
  </div>;
};
