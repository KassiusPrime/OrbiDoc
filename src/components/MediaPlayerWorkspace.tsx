import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowsShuffle as Shuffle,
  IconClock as Clock,
  IconFolderOpen as FolderOpen,
  IconInfoCircle as Info,
  IconMaximize as Fullscreen,
  IconPictureInPicture as PictureInPicture,
  IconPlayerPause as Pause,
  IconPlayerPlay as Play,
  IconPlayerSkipBack as Previous,
  IconPlayerSkipForward as Next,
  IconRepeat as Repeat,
  IconSearch as Search,
  IconSubtitles as Subtitles,
  IconTrash as Trash,
  IconUpload as Upload,
  IconVolume as Volume,
  IconVolumeOff as VolumeOff,
  IconWorld as World,
  IconX as Close,
} from '@tabler/icons-react';

type PlaylistItem = {
  id: string;
  name: string;
  url: string;
  type: string;
  source: 'local' | 'network';
  resumeKey: string;
  size?: number;
};
type ABLoop = { start: number; end: number | null };

const STREAMS_KEY = 'orbit_player_recent_streams_v2';
const RESUME_KEY = 'orbit_player_resume_v1';
const MAX_PLAYLIST_ITEMS = 100;
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.floor(value % 60);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours ? String(hours) + ':' + mm + ':' + ss : String(minutes) + ':' + ss;
};
const extensionOf = (name: string) => name.split(/[?#]/)[0].split('.').pop()?.toLowerCase() || '';
const getMediaType = (name: string, type = '') => {
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/i.test(name)) return 'audio';
  if (type.startsWith('video/') || /\.(mp4|webm|m4v|mov|mkv|avi|mpeg|mpg|m3u8|mpd|ogv|3gp)$/i.test(name)) return 'video';
  return 'unknown';
};
const isVideoItem = (item: PlaylistItem | null) => Boolean(item && getMediaType(item.url, item.type) !== 'audio');
const safeLoadJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};
const readResumePositions = () => safeLoadJson<Record<string, number>>(RESUME_KEY, {});

function toWebVtt(text: string, isSrt: boolean) {
  const normalized = isSrt
    ? text.replace(/^\s*\d+\s*$/gm, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    : text.replace(/^\uFEFF/, '');
  return 'WEBVTT\n\n' + normalized.trim() + '\n';
}

export const MediaPlayerWorkspace: React.FC<{
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}> = ({ showNotification = () => {} }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const subtitleRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const playlistRef = useRef<PlaylistItem[]>([]);
  const subtitleUrlRef = useRef('');
  const touchStart = useRef<{ x: number; y: number; width: number } | null>(null);
  const lastSavedSecond = useRef(0);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [query, setQuery] = useState('');
  const [recentStreams, setRecentStreams] = useState<string[]>(() => safeLoadJson(STREAMS_KEY, []));
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [subtitleUrl, setSubtitleUrl] = useState('');
  const [subtitleName, setSubtitleName] = useState('');
  const [visualBrightness, setVisualBrightness] = useState(1);
  const [ab, setAb] = useState<ABLoop | null>(null);
  const [jumpTime, setJumpTime] = useState('');
  const [error, setError] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const active = playlist.find((item) => item.id === activeId) || playlist[0] || null;
  const isVideo = isVideoItem(active);
  const filteredPlaylist = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? playlist.filter((item) => item.name.toLocaleLowerCase().includes(needle)) : playlist;
  }, [playlist, query]);

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);

  useEffect(() => () => {
    playlistRef.current.filter((item) => item.source === 'local').forEach((item) => URL.revokeObjectURL(item.url));
    if (subtitleUrlRef.current) URL.revokeObjectURL(subtitleUrlRef.current);
  }, []);

  const go = useCallback((direction: -1 | 1) => {
    const list = playlistRef.current;
    if (!list.length) return;
    const index = Math.max(0, list.findIndex((item) => item.id === activeId));
    const nextIndex = shuffle ? Math.floor(Math.random() * list.length) : (index + direction + list.length) % list.length;
    setActiveId(list[nextIndex].id);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setError('');
    setAb(null);
  }, [activeId, shuffle]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.volume = volume;
    media.muted = muted;
    media.playbackRate = rate;
    media.loop = loop && !ab;
    if ('mediaSession' in navigator && active) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: active.name, artist: 'Orbit Player', album: 'Playlist' });
        navigator.mediaSession.setActionHandler('play', () => void media.play());
        navigator.mediaSession.setActionHandler('pause', () => media.pause());
        navigator.mediaSession.setActionHandler('seekbackward', (details) => { media.currentTime = Math.max(0, media.currentTime - (details.seekOffset || 10)); });
        navigator.mediaSession.setActionHandler('seekforward', (details) => { media.currentTime = Math.min(media.duration || Infinity, media.currentTime + (details.seekOffset || 10)); });
        navigator.mediaSession.setActionHandler('previoustrack', () => go(-1));
        navigator.mediaSession.setActionHandler('nexttrack', () => go(1));
      } catch { /* Media Session support varies by browser and WebView. */ }
    }
  }, [activeId, active, volume, muted, rate, loop, ab, go]);

  const savePosition = useCallback((item: PlaylistItem, time: number) => {
    if (!Number.isFinite(time) || time < 0) return;
    const stored = readResumePositions();
    stored[item.resumeKey] = time;
    try { localStorage.setItem(RESUME_KEY, JSON.stringify(stored)); } catch { /* Keep playback usable when storage is unavailable. */ }
  }, []);

  const onMediaTime = (time: number) => {
    setCurrent(time);
    if (ab?.end !== null && ab?.end !== undefined && time >= ab.end && ab.end > ab.start && mediaRef.current) {
      mediaRef.current.currentTime = ab.start;
      setCurrent(ab.start);
    }
    if (active && time - lastSavedSecond.current >= 3) {
      lastSavedSecond.current = time;
      savePosition(active, time);
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const accepted = Array.from(files).filter((file) =>
      file.type.startsWith('audio/') || file.type.startsWith('video/') ||
      /\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma|mp4|webm|m4v|mov|mkv|avi|mpeg|mpg|m3u8|mpd|ogv|3gp)$/i.test(file.name),
    );
    if (!accepted.length) {
      showNotification('Selecione um arquivo de áudio ou vídeo.', 'error');
      return;
    }
    const remaining = Math.max(0, MAX_PLAYLIST_ITEMS - playlistRef.current.length);
    const next = accepted.slice(0, remaining).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type || (getMediaType(file.name) === 'audio' ? 'audio/unknown' : 'video/unknown'),
      source: 'local' as const,
      resumeKey: 'file:' + file.name + ':' + file.size + ':' + file.lastModified,
      size: file.size,
    }));
    if (!next.length) {
      showNotification('A playlist já atingiu o limite de ' + MAX_PLAYLIST_ITEMS + ' itens.', 'error');
      return;
    }
    setPlaylist((previous) => [...previous, ...next]);
    setActiveId((previous) => previous || next[0].id);
    if (accepted.length > next.length) showNotification('Foram adicionados ' + next.length + ' arquivos; o limite da playlist é ' + MAX_PLAYLIST_ITEMS + '.', 'error');
  };

  const addStream = (requested?: string) => {
    const url = (requested ?? streamUrl).trim();
    if (!url) return;
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Esquema inválido');
    } catch {
      showNotification('Informe uma URL HTTP/HTTPS direta para a mídia.', 'error');
      return;
    }
    const canonical = parsed.href;
    const existing = playlistRef.current.find((item) => item.source === 'network' && item.url === canonical);
    if (existing) {
      setActiveId(existing.id);
      setStreamUrl('');
      showNotification('A URL já estava na playlist; selecionei esse item.', 'success');
      return;
    }
    if (playlistRef.current.length >= MAX_PLAYLIST_ITEMS) {
      showNotification('A playlist atingiu o limite de ' + MAX_PLAYLIST_ITEMS + ' itens.', 'error');
      return;
    }
    const path = parsed.pathname + parsed.search;
    const type = getMediaType(path) === 'audio' ? 'audio/network' : 'video/network';
    const lastSegment = parsed.pathname.split('/').pop() || parsed.host;
    let name = lastSegment;
    try { name = decodeURIComponent(lastSegment); } catch { /* Retain the original segment. */ }
    const item: PlaylistItem = { id: crypto.randomUUID(), name: name.slice(0, 100), url: canonical, type, source: 'network', resumeKey: 'url:' + canonical };
    setPlaylist((previous) => [item, ...previous]);
    setActiveId(item.id);
    setStreamUrl('');
    const next = [canonical, ...recentStreams.filter((entry) => entry !== canonical)].slice(0, 12);
    setRecentStreams(next);
    try { localStorage.setItem(STREAMS_KEY, JSON.stringify(next)); } catch { /* Recent links are an optional convenience. */ }
  };

  const togglePlay = async () => {
    const media = mediaRef.current;
    if (!media || !active) return;
    setError('');
    try {
      if (media.paused) await media.play();
      else media.pause();
    } catch {
      setError('O navegador bloqueou a reprodução ou não conseguiu decodificar este formato.');
    }
  };

  const remove = (item: PlaylistItem) => {
    if (item.source === 'local') URL.revokeObjectURL(item.url);
    const remaining = playlist.filter((entry) => entry.id !== item.id);
    setPlaylist(remaining);
    if (activeId === item.id) {
      setActiveId(remaining[0]?.id || null);
      setCurrent(0);
      setDuration(0);
      setError('');
    }
  };

  const loadSubtitle = async (file?: File) => {
    if (!file) return;
    if (!/\.(vtt|srt)$/i.test(file.name)) {
      showNotification('Use uma legenda WebVTT (.vtt) ou SubRip (.srt).', 'error');
      return;
    }
    try {
      const text = await file.text();
      const vtt = toWebVtt(text, /\.srt$/i.test(file.name));
      const url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt;charset=utf-8' }));
      if (subtitleUrlRef.current) URL.revokeObjectURL(subtitleUrlRef.current);
      subtitleUrlRef.current = url;
      setSubtitleUrl(url);
      setSubtitleName(file.name);
      showNotification('Legenda carregada: ' + file.name, 'success');
    } catch {
      showNotification('Não foi possível ler a legenda.', 'error');
    }
  };

  const jump = () => {
    const parts = jumpTime.trim().split(':').map(Number);
    if (!jumpTime.trim() || parts.some((part) => !Number.isFinite(part) || part < 0)) return;
    let seconds = 0;
    if (parts.length === 1) seconds = parts[0];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else { showNotification('Use segundos ou o formato HH:MM:SS.', 'error'); return; }
    const media = mediaRef.current;
    if (!media || (Number.isFinite(media.duration) && seconds > media.duration)) {
      showNotification('O tempo informado está fora da duração da mídia.', 'error');
      return;
    }
    media.currentTime = seconds;
    setCurrent(seconds);
    setJumpTime('');
  };

  const setABPoint = () => {
    if (!ab) {
      setAb({ start: current, end: null });
      showNotification('Ponto A definido. Defina B para ativar o loop.', 'success');
    } else if (ab.end === null) {
      if (current <= ab.start) { showNotification('B precisa estar depois de A.', 'error'); return; }
      setAb({ start: ab.start, end: current });
      showNotification('Loop A–B ativado.', 'success');
    } else {
      setAb(null);
      showNotification('Loop A–B removido.', 'success');
    }
  };

  const pictureInPicture = async () => {
    const video = mediaRef.current as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<PictureInPictureWindow> }) | null;
    if (!video?.requestPictureInPicture) { showNotification('Picture-in-Picture não é suportado nesta plataforma.', 'error'); return; }
    try { await video.requestPictureInPicture(); } catch { showNotification('Não foi possível abrir Picture-in-Picture.', 'error'); }
  };

  const fullscreen = async () => {
    try { await stageRef.current?.requestFullscreen?.(); } catch { showNotification('Tela cheia indisponível neste dispositivo.', 'error'); }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
    const media = mediaRef.current;
    if (!media) return;
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'k') { event.preventDefault(); void togglePlay(); }
    else if (key === 'arrowleft' || key === 'j') { event.preventDefault(); media.currentTime = Math.max(0, media.currentTime - 5); }
    else if (key === 'arrowright' || key === 'l') { event.preventDefault(); media.currentTime = Math.min(media.duration || Infinity, media.currentTime + 5); }
    else if (key === 'm') setMuted((value) => !value);
    else if (key === 'f') void fullscreen();
  };

  const touchStartHandler = (event: React.TouchEvent<HTMLDivElement>) => {
    const point = event.changedTouches[0];
    touchStart.current = { x: point.clientX, y: point.clientY, width: event.currentTarget.clientWidth };
  };

  const touchEndHandler = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const media = mediaRef.current;
    if (!start || !media || !active) return;
    touchStart.current = null;
    const point = event.changedTouches[0];
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      const offset = Math.max(5, Math.min(90, Math.round(Math.abs(dx) / 5)));
      media.currentTime = Math.max(0, Math.min(media.duration || Infinity, media.currentTime + (dx > 0 ? offset : -offset)));
      return;
    }
    if (Math.abs(dy) > 32 && Math.abs(dy) > Math.abs(dx) * 1.3) {
      const fraction = Math.min(0.3, Math.abs(dy) / 180);
      if (start.x < start.width * 0.28) {
        setVisualBrightness((value) => Math.max(0.45, Math.min(1.6, value + (dy < 0 ? fraction : -fraction))));
        showNotification('Brilho visual do player ajustado.', 'success');
      } else if (start.x > start.width * 0.72) {
        setVolume((value) => Math.max(0, Math.min(1, value + (dy < 0 ? fraction : -fraction))));
        setMuted(false);
      }
    }
  };

  const resumeAtMetadata = () => {
    const media = mediaRef.current;
    if (!media || !active) return;
    const saved = readResumePositions()[active.resumeKey];
    if (Number.isFinite(saved) && saved > 3 && (!Number.isFinite(media.duration) || saved < media.duration - 12)) {
      media.currentTime = saved;
      setCurrent(saved);
    }
    setDuration(Number.isFinite(media.duration) ? media.duration : 0);
    media.volume = volume;
    media.muted = muted;
    media.playbackRate = rate;
    media.loop = loop && !ab;
  };

  const isVideo = isVideoItem(active);
  const mediaElement = active ? (
    isVideo ? (
      <video
        key={active.id}
        ref={(node) => { mediaRef.current = node; }}
        src={active.url}
        playsInline
        preload="metadata"
        className="h-full max-h-[min(62dvh,760px)] w-full bg-black object-contain"
        style={{ filter: 'brightness(' + visualBrightness + ')' }}
        onLoadedMetadata={resumeAtMetadata}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => onMediaTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onEnded={() => { setPlaying(false); if (!loop && !ab?.end) go(1); }}
        onError={() => setError('O navegador/WebView não conseguiu abrir este codec, contêiner ou origem da mídia. Tente outro formato ou um reprodutor nativo compatível.')}
      >
        {subtitleUrl ? <track kind="subtitles" src={subtitleUrl} srcLang="pt-BR" label={subtitleName || 'Legenda'} default /> : null}
      </video>
    ) : (
      <div className="flex min-h-[280px] w-full flex-col items-center justify-center bg-gradient-to-br from-[#080D18] via-[#101827] to-[#182F8D] p-8 text-center" style={{ filter: 'brightness(' + visualBrightness + ')' }}>
        <div className="grid h-24 w-24 place-items-center rounded-full border border-white/10 bg-white/5 text-blue-200"><i className="fi fi-rr-music text-4xl" aria-hidden="true" /></div>
        <div className="mt-4 max-w-lg truncate text-sm font-semibold text-white">{active.name}</div>
        <div className="mt-1 text-[10px] text-white/60">Áudio · {active.source === 'local' ? 'arquivo local' : 'URL direta'}</div>
        <audio
          key={active.id}
          ref={(node) => { mediaRef.current = node; }}
          src={active.url}
          preload="metadata"
          onLoadedMetadata={resumeAtMetadata}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => onMediaTime(event.currentTarget.currentTime)}
          onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onEnded={() => { setPlaying(false); if (!loop && !ab?.end) go(1); }}
          onError={() => setError('O navegador/WebView não conseguiu decodificar este formato de áudio ou abrir sua origem.')}
        />
      </div>
    )
  ) : (
    <div className="flex min-h-[320px] flex-col items-center justify-center bg-[#080D18] p-8 text-center text-slate-500">
      <i className="fi fi-rr-play-circle text-5xl text-blue-300/70" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold text-white">Abra sua primeira mídia</h2>
      <p className="mt-2 max-w-md text-xs leading-relaxed">Adicione arquivos locais ou uma URL direta e o Orbit manterá sua playlist nesta sessão.</p>
      <button type="button" onClick={() => fileRef.current?.click()} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white"><FolderOpen className="h-4 w-4" /> Abrir arquivos</button>
    </div>
  );

  return (
    <div className="orbit-player mx-auto w-full max-w-[1600px] space-y-4 pb-6">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#101827] sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200"><i className="fi fi-rr-play-alt text-2xl" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">Orbit Player · reprodução</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Mídia sem complicação.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">Playlist local, links diretos, legendas, retomada, gestos, velocidade de 0,25× a 4×, PiP e loop A–B. A compatibilidade depende do mecanismo de mídia do dispositivo; este modo web não incorpora LibVLC.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" multiple accept="audio/*,video/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus,.mp4,.webm,.m4v,.mov,.mkv,.avi,.m3u8,.mpd" className="hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = ''; }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-3.5 text-xs font-semibold text-white hover:bg-violet-700"><Upload className="h-4 w-4" /> Abrir mídia</button>
            <input ref={subtitleRef} type="file" accept=".vtt,.srt,text/vtt,application/x-subrip" className="hidden" onChange={(event) => { void loadSubtitle(event.target.files?.[0]); event.currentTarget.value = ''; }} />
            <button type="button" onClick={() => subtitleRef.current?.click()} disabled={!isVideo || !active} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-35 dark:border-slate-700 dark:hover:bg-slate-800"><Subtitles className="h-4 w-4" /> Legenda</button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#101827]">
          <div ref={stageRef} tabIndex={0} onKeyDown={handleKeyDown} onTouchStart={touchStartHandler} onTouchEnd={touchEndHandler}
            onDoubleClick={(event) => {
              if (!active || !mediaRef.current) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const position = event.clientX - bounds.left;
              if (position < bounds.width * 0.33) mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 10);
              else if (position > bounds.width * 0.67) mediaRef.current.currentTime = Math.min(mediaRef.current.duration || Infinity, mediaRef.current.currentTime + 10);
              else void togglePlay();
            }}
            className="relative flex min-h-[280px] select-none items-center justify-center overflow-hidden bg-[#05070b] outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
            {mediaElement}
            {active && error ? <div role="alert" className="absolute inset-x-3 bottom-3 rounded-xl border border-rose-400/25 bg-black/85 p-3 text-xs text-rose-100 backdrop-blur"><div className="font-semibold">Não foi possível reproduzir</div><p className="mt-1 leading-relaxed text-rose-100/80">{error}</p></div> : null}
            {active && ab ? <div className="absolute left-3 top-3 rounded-lg border border-white/10 bg-black/65 px-2 py-1 text-[10px] text-white">Loop A {formatTime(ab.start)} {ab.end !== null ? '→ B ' + formatTime(ab.end) : '· defina B'}</div> : null}
            {active ? <div className="absolute right-3 top-3 rounded-lg bg-black/55 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-white/75">{isVideo ? 'Vídeo' : 'Áudio'} · {active.source === 'local' ? 'Local' : 'Rede'}</div> : null}
          </div>

          <div className="border-t border-slate-200 p-3 dark:border-slate-800 sm:p-4">
            <input aria-label="Posição na mídia" type="range" min={0} max={Math.max(duration, 0.01)} step="0.1" value={Math.min(current, duration || 0)} onChange={(event) => { const time = Number(event.target.value); setCurrent(time); if (mediaRef.current) mediaRef.current.currentTime = time; }} className="w-full accent-violet-600" />
            <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-slate-500"><span>{formatTime(current)}</span><span>{duration ? formatTime(duration) : '--:--'}</span></div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={() => go(-1)} disabled={!playlist.length} title="Anterior" aria-label="Mídia anterior" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><Previous className="h-4 w-4" /></button>
              <button type="button" onClick={() => { if (mediaRef.current) mediaRef.current.currentTime = Math.max(0, current - 10); }} disabled={!active} title="Voltar 10 segundos" className="h-9 rounded-xl px-2 text-[10px] font-semibold hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">−10s</button>
              <button type="button" onClick={() => void togglePlay()} disabled={!active} aria-label={playing ? 'Pausar' : 'Reproduzir'} className="grid h-12 w-12 place-items-center rounded-full bg-violet-600 text-white shadow-sm hover:bg-violet-700 disabled:opacity-30">{playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}</button>
              <button type="button" onClick={() => { if (mediaRef.current) mediaRef.current.currentTime = Math.min(duration || Infinity, current + 10); }} disabled={!active} title="Avançar 10 segundos" className="h-9 rounded-xl px-2 text-[10px] font-semibold hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">+10s</button>
              <button type="button" onClick={() => go(1)} disabled={!playlist.length} title="Próximo" aria-label="Próxima mídia" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><Next className="h-4 w-4" /></button>
              <button type="button" onClick={() => setShuffle((value) => !value)} aria-pressed={shuffle} title="Aleatório" className={'grid h-9 w-9 place-items-center rounded-xl ' + (shuffle ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}><Shuffle className="h-4 w-4" /></button>
              <button type="button" onClick={() => setLoop((value) => !value)} aria-pressed={loop} title="Repetir item" className={'grid h-9 w-9 place-items-center rounded-xl ' + (loop ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}><Repeat className="h-4 w-4" /></button>
              {isVideo ? <button type="button" onClick={() => void pictureInPicture()} title="Picture-in-Picture" aria-label="Picture-in-Picture" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><PictureInPicture className="h-4 w-4" /></button> : null}
              <button type="button" onClick={() => void fullscreen()} title="Tela cheia" aria-label="Tela cheia" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><Fullscreen className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                {muted ? <VolumeOff className="h-4 w-4 text-slate-500" /> : <Volume className="h-4 w-4 text-slate-500" />}
                <input aria-label="Volume" type="range" min="0" max="1" step="0.02" value={volume} onChange={(event) => { setVolume(Number(event.target.value)); setMuted(false); }} className="min-w-0 flex-1 accent-violet-600" />
                <button type="button" onClick={() => setMuted((value) => !value)} className="text-[10px] font-semibold text-slate-500">{muted ? 'Ativar som' : String(Math.round(volume * 100)) + '%'}</button>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                <Clock className="h-4 w-4 shrink-0 text-slate-500" />
                <label className="text-[10px] text-slate-500" htmlFor="orbit-jump-time">Ir para</label>
                <input id="orbit-jump-time" value={jumpTime} onChange={(event) => setJumpTime(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') jump(); }} placeholder="00:02:30" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
                <button type="button" onClick={jump} className="text-[10px] font-semibold text-violet-600 dark:text-violet-300">Ir</button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-[10px] text-slate-500" htmlFor="orbit-playback-speed">Velocidade</label>
              <select id="orbit-playback-speed" value={rate} onChange={(event) => setRate(Number(event.target.value))} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[10px] dark:border-slate-700 dark:bg-slate-950">
                {SPEEDS.map((speed) => <option key={speed} value={speed}>{speed.toLocaleString('pt-BR')}×</option>)}
              </select>
              <button type="button" onClick={setABPoint} disabled={!active || !isVideo} className={'h-8 rounded-lg border px-2.5 text-[10px] font-semibold disabled:opacity-35 ' + (ab ? 'border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300' : 'border-slate-200 text-slate-500 dark:border-slate-700')}>{ab?.end !== null && ab?.end !== undefined ? 'Limpar A–B' : ab ? 'Definir B' : 'Marcar A–B'}</button>
              <button type="button" onClick={() => setShowInfo((value) => !value)} disabled={!active} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"><Info className="h-3.5 w-3.5" /> Informações</button>
            </div>
            {showInfo && active ? <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"><div className="font-semibold text-slate-900 dark:text-white">{active.name}</div><div className="mt-1">Fonte: {active.source === 'local' ? 'Arquivo local' : 'URL direta'} · Tipo: {active.type}</div><div>Duração: {duration ? formatTime(duration) : 'Não informada'} · Tamanho local: {active.size ? (active.size / (1024 * 1024)).toFixed(2) + ' MB' : 'Não informado'}</div><div>Retomada salva neste dispositivo · codecs dependem da plataforma.</div></div> : null}
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#101827]">
            <div className="flex items-center gap-2"><World className="h-4 w-4 text-violet-600" /><h2 className="text-sm font-semibold">Abrir URL direta</h2></div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Use uma URL da mídia que você tem autorização para acessar. Páginas comuns e links protegidos podem não ser reproduzíveis.</p>
            <div className="mt-3 flex gap-2">
              <input value={streamUrl} onChange={(event) => setStreamUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addStream(); }} placeholder="https://servidor/video.mp4" className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[10px] dark:border-slate-700 dark:bg-slate-950" />
              <button type="button" onClick={() => addStream()} className="h-10 rounded-xl bg-violet-600 px-3 text-[10px] font-semibold text-white">Abrir</button>
            </div>
            {recentStreams.length ? <div className="mt-3 space-y-1">{recentStreams.map((url) => <div key={url} className="flex items-center gap-1"><button type="button" onClick={() => addStream(url)} className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-[9px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{url}</button><button type="button" onClick={() => { const next = recentStreams.filter((item) => item !== url); setRecentStreams(next); try { localStorage.setItem(STREAMS_KEY, JSON.stringify(next)); } catch { /* optional */ } }} aria-label="Remover URL recente" className="rounded-md p-1 text-slate-500 hover:text-rose-500"><Close className="h-3 w-3" /></button></div>)}</div> : null}
          </section>

          <section className="min-h-[260px] min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#101827]">
            <div className="flex items-center gap-2"><i className="fi fi-rr-play-alt text-violet-600" aria-hidden="true" /><h2 className="text-sm font-semibold">Playlist</h2><span className="ml-auto text-[9px] text-slate-500">{playlist.length}/{MAX_PLAYLIST_ITEMS}</span></div>
            <label className="mt-3 flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-400 dark:border-slate-700 dark:bg-slate-950"><Search className="h-3.5 w-3.5" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar playlist…" className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-800 outline-none dark:text-slate-100" /></label>
            <div className="mt-3 max-h-[360px] space-y-1 overflow-y-auto">
              {filteredPlaylist.length ? filteredPlaylist.map((item, index) => (
                <div key={item.id} className={'flex min-w-0 items-center gap-2 rounded-xl p-2 ' + (active?.id === item.id ? 'bg-violet-50 dark:bg-violet-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50')}>
                  <button type="button" onClick={() => { setActiveId(item.id); setError(''); setCurrent(0); setAb(null); }} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[10px] font-semibold">{index + 1}. {item.name}</span>
                    <span className="mt-0.5 block truncate text-[8px] uppercase text-slate-400">{item.source === 'local' ? 'Local' : 'URL direta'} · {getMediaType(item.url, item.type) === 'audio' ? 'Áudio' : 'Vídeo'}</span>
                  </button>
                  <button type="button" onClick={() => remove(item)} title="Remover da playlist" aria-label={'Remover ' + item.name} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"><Trash className="h-3.5 w-3.5" /></button>
                </div>
              )) : <div className="p-5 text-center text-[10px] text-slate-500">{playlist.length ? 'Nenhum item corresponde à busca.' : 'Adicione arquivos locais ou uma URL direta.'}</div>}
            </div>
            {subtitleName ? <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3 text-[9px] text-slate-500 dark:border-slate-800"><Subtitles className="h-3.5 w-3.5" /><span className="min-w-0 flex-1 truncate">{subtitleName}</span><button type="button" onClick={() => { if (subtitleUrlRef.current) URL.revokeObjectURL(subtitleUrlRef.current); subtitleUrlRef.current = ''; setSubtitleUrl(''); setSubtitleName(''); }} className="text-rose-500">Remover legenda</button></div> : null}
          </section>
          <div className="px-1 text-[10px] leading-relaxed text-slate-400">Gestos: deslize horizontalmente para buscar; deslize verticalmente à esquerda para brilho visual e à direita para volume; duplo toque à esquerda/direita para saltos de 10 s. Teclas: Espaço/K, J/L, M e F.</div>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-slate-400">
        <span>Interface própria inspirada em padrões de reprodutores completos; sem código nem marca do VLC.</span>
        <a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer" className="hover:text-violet-500">Uicons by Flaticon</a>
      </footer>
    </div>
  );
};
