import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowsShuffle as Shuffle,
  IconMaximize as Fullscreen,
  IconPictureInPicture as PictureInPicture,
  IconPlayerPause as Pause,
  IconPlayerPlay as Play,
  IconPlayerSkipBack as Previous,
  IconPlayerSkipForward as Next,
  IconRepeat as Repeat,
  IconSubtitles as Subtitles,
  IconTrash as Trash,
  IconUpload as Upload,
  IconVolume as Volume,
  IconVolumeOff as VolumeOff,
  IconWorld as World,
} from '@tabler/icons-react';

type PlaylistItem = { id: string; name: string; url: string; type: string; source: 'local' | 'network' };
const STREAMS_KEY = 'orbidoc_media_streams_v1';
const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const hours = Math.floor(value / 3600); const minutes = Math.floor((value % 3600) / 60); const seconds = Math.floor(value % 60);
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const MediaPlayerWorkspace: React.FC<{ showNotification?: (message: string, type?: 'success' | 'error') => void }> = ({ showNotification = () => {} }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const subtitleRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [recentStreams, setRecentStreams] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(STREAMS_KEY) || '[]'); } catch { return []; } });
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [subtitleUrl, setSubtitleUrl] = useState('');

  const active = playlist.find((item) => item.id === activeId) || playlist[0] || null;
  const isVideo = Boolean(active && (active.type.startsWith('video/') || /\.(mp4|webm|m4v|mov|mkv)(\?|$)/i.test(active.url)));

  useEffect(() => () => {
    playlist.filter((item) => item.source === 'local').forEach((item) => URL.revokeObjectURL(item.url));
    if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
  }, []);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.volume = volume; media.muted = muted; media.playbackRate = rate; media.loop = loop;
  }, [activeId, volume, muted, rate, loop]);

  useEffect(() => {
    if (!activeId && playlist[0]) setActiveId(playlist[0].id);
  }, [playlist, activeId]);

  const addFiles = (files: FileList | File[]) => {
    const next = Array.from(files).filter((file) => file.type.startsWith('audio/') || file.type.startsWith('video/') || /\.(mp3|wav|ogg|flac|m4a|aac|mp4|webm|m4v|mov|mkv)$/i.test(file.name)).slice(0, 100).map((file) => ({ id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file), type: file.type || 'application/octet-stream', source: 'local' as const }));
    if (!next.length) { showNotification('Nenhum arquivo de áudio ou vídeo compatível foi selecionado.', 'error'); return; }
    setPlaylist((current) => [...current, ...next]);
    if (!activeId) setActiveId(next[0].id);
  };

  const addStream = () => {
    const url = streamUrl.trim();
    if (!url) return;
    try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); }
    catch { showNotification('Informe uma URL HTTP/HTTPS válida de áudio ou vídeo.', 'error'); return; }
    const item = { id: crypto.randomUUID(), name: url.replace(/^https?:\/\//, '').slice(0, 72), url, type: 'video/network', source: 'network' as const };
    setPlaylist((current) => [item, ...current]); setActiveId(item.id); setStreamUrl('');
    const next = [url, ...recentStreams.filter((entry) => entry !== url)].slice(0, 8); setRecentStreams(next); localStorage.setItem(STREAMS_KEY, JSON.stringify(next));
  };

  const togglePlay = async () => {
    const media = mediaRef.current; if (!media) return;
    try { if (media.paused) await media.play(); else media.pause(); } catch { showNotification('O navegador não conseguiu reproduzir esta mídia ou codec.', 'error'); }
  };
  const go = (direction: -1 | 1) => {
    if (!playlist.length) return;
    const index = Math.max(0, playlist.findIndex((item) => item.id === activeId));
    const nextIndex = shuffle ? Math.floor(Math.random() * playlist.length) : (index + direction + playlist.length) % playlist.length;
    setActiveId(playlist[nextIndex].id); setPlaying(false); setCurrent(0);
  };
  const remove = (item: PlaylistItem) => {
    if (item.source === 'local') URL.revokeObjectURL(item.url);
    const remaining = playlist.filter((entry) => entry.id !== item.id); setPlaylist(remaining);
    if (activeId === item.id) setActiveId(remaining[0]?.id || null);
  };
  const loadSubtitle = (file?: File) => {
    if (!file) return;
    if (!/\.vtt$/i.test(file.name)) { showNotification('Use legendas WebVTT (.vtt).', 'error'); return; }
    if (subtitleUrl) URL.revokeObjectURL(subtitleUrl); setSubtitleUrl(URL.createObjectURL(file)); showNotification('Legenda WebVTT carregada.', 'success');
  };
  const pictureInPicture = async () => {
    const video = mediaRef.current as HTMLVideoElement | null;
    if (!video || !('requestPictureInPicture' in video)) { showNotification('Picture-in-Picture não é suportado neste navegador.', 'error'); return; }
    try { await (video as any).requestPictureInPicture(); } catch { showNotification('Não foi possível abrir Picture-in-Picture.', 'error'); }
  };
  const fullscreen = async () => { try { await (mediaRef.current?.parentElement as HTMLElement | undefined)?.requestFullscreen?.(); } catch { showNotification('Tela cheia indisponível.', 'error'); } };

  const player = active ? (isVideo ? <video key={active.id} ref={(node) => { mediaRef.current = node; }} src={active.url} className="w-full h-full max-h-[620px] object-contain bg-black" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(event.currentTarget.duration)} onEnded={() => { setPlaying(false); if (!loop) go(1); }}>{subtitleUrl && <track kind="subtitles" src={subtitleUrl} default label="Legenda" />}</video> : <div className="w-full min-h-[320px] flex items-center justify-center bg-gradient-to-br from-[#080D18] via-[#101827] to-[#182F8D]"><div className="w-32 h-32 rounded-full border border-white/10 bg-white/5 flex items-center justify-center"><Volume className="w-14 h-14 text-[#7AA2FF]" /></div><audio key={active.id} ref={(node) => { mediaRef.current = node; }} src={active.url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(event.currentTarget.duration)} onEnded={() => { setPlaying(false); if (!loop) go(1); }} /></div>) : <div className="min-h-[420px] flex flex-col items-center justify-center text-slate-400"><Play className="w-16 h-16 opacity-25" /><div className="mt-4 text-sm font-black">Nenhuma mídia aberta</div><div className="mt-1 text-xs">Adicione arquivos locais ou uma URL de mídia.</div></div>;

  return <div className="orbidoc-media-studio max-w-[1500px] mx-auto space-y-4">
    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"><div className="flex flex-col xl:flex-row xl:items-center gap-4"><div className="flex-1"><div className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400"><Play className="w-4 h-4" /> Player multimídia</div><h2 className="mt-1 text-2xl font-black">Vídeo, áudio e streams</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Playlist local, velocidade, repetição, legendas VTT, PiP, tela cheia e URLs HTTP/HTTPS. A reprodução depende dos codecs suportados pelo navegador/WebView.</p></div><div className="flex flex-wrap gap-2"><input ref={fileRef} type="file" multiple accept="audio/*,video/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.mp4,.webm,.m4v,.mov,.mkv" className="hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} /><button onClick={() => fileRef.current?.click()} className="h-10 px-3 rounded-xl bg-indigo-600 text-white text-xs font-black inline-flex items-center gap-2"><Upload className="w-4 h-4" /> Abrir mídia</button><input ref={subtitleRef} type="file" accept=".vtt,text/vtt" className="hidden" onChange={(event) => { loadSubtitle(event.target.files?.[0]); event.target.value = ''; }} /><button onClick={() => subtitleRef.current?.click()} disabled={!isVideo} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black inline-flex items-center gap-2 disabled:opacity-40"><Subtitles className="w-4 h-4" /> Legenda VTT</button></div></div></section>

    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4"><section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"><div className="bg-black min-h-[360px] flex items-center justify-center">{player}</div><div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800"><input type="range" min={0} max={Math.max(duration, 0.01)} step="0.1" value={Math.min(current, duration || 0)} onChange={(event) => { const value = Number(event.target.value); setCurrent(value); if (mediaRef.current) mediaRef.current.currentTime = value; }} className="w-full accent-indigo-600" /><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[10px] tabular-nums text-slate-400 w-24">{formatTime(current)} / {formatTime(duration)}</span><button onClick={() => go(-1)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><Previous className="w-4 h-4 mx-auto" /></button><button onClick={() => void togglePlay()} disabled={!active} className="w-11 h-11 rounded-full bg-indigo-600 text-white disabled:opacity-30">{playing ? <Pause className="w-5 h-5 mx-auto" /> : <Play className="w-5 h-5 mx-auto" />}</button><button onClick={() => go(1)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><Next className="w-4 h-4 mx-auto" /></button><button onClick={() => setShuffle((value) => !value)} className={`w-9 h-9 rounded-xl ${shuffle ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Aleatório"><Shuffle className="w-4 h-4 mx-auto" /></button><button onClick={() => setLoop((value) => !value)} className={`w-9 h-9 rounded-xl ${loop ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Repetir"><Repeat className="w-4 h-4 mx-auto" /></button><button onClick={() => setMuted((value) => !value)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">{muted ? <VolumeOff className="w-4 h-4 mx-auto" /> : <Volume className="w-4 h-4 mx-auto" />}</button><input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-24 accent-indigo-600" /><select value={rate} onChange={(event) => setRate(Number(event.target.value))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-[10px] font-black">{[0.25,0.5,0.75,1,1.25,1.5,1.75,2,2.5,3].map((value) => <option key={value} value={value}>{value}×</option>)}</select>{isVideo && <><button onClick={() => void pictureInPicture()} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" title="Picture-in-Picture"><PictureInPicture className="w-4 h-4 mx-auto" /></button><button onClick={() => void fullscreen()} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" title="Tela cheia"><Fullscreen className="w-4 h-4 mx-auto" /></button></>}</div></div></section>

      <aside className="space-y-4"><section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"><div className="flex items-center gap-2"><World className="w-4 h-4 text-indigo-600" /><h3 className="text-sm font-black">Abrir URL</h3></div><div className="mt-3 flex gap-2"><input value={streamUrl} onChange={(event) => setStreamUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addStream(); }} placeholder="https://…/video.mp4" className="min-w-0 flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-[10px]" /><button onClick={addStream} className="h-10 px-3 rounded-xl bg-indigo-600 text-white text-[10px] font-black">Abrir</button></div>{recentStreams.length > 0 && <div className="mt-3 space-y-1">{recentStreams.map((url) => <button key={url} onClick={() => setStreamUrl(url)} className="w-full text-left text-[9px] truncate text-slate-400 hover:text-indigo-600">{url}</button>)}</div>}</section>

      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-sm font-black">Playlist</h3><span className="text-[9px] text-slate-400">{playlist.length} item(ns)</span></div><div className="mt-3 max-h-[430px] overflow-y-auto space-y-1">{playlist.length ? playlist.map((item, index) => <div key={item.id} className={`rounded-xl flex items-center gap-2 p-2 ${active?.id === item.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}><button onClick={() => setActiveId(item.id)} className="min-w-0 flex-1 text-left"><div className="text-[10px] font-black truncate">{index + 1}. {item.name}</div><div className="text-[8px] text-slate-400 uppercase">{item.source === 'local' ? 'local' : 'rede'}</div></button><button onClick={() => remove(item)} className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash className="w-3.5 h-3.5 mx-auto" /></button></div>) : <div className="p-8 text-center text-[10px] text-slate-400">Sua playlist aparecerá aqui.</div>}</div></section></aside></div>
  </div>;
};
