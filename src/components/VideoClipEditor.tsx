import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCamera as Camera,
  IconCut as Cut,
  IconDownload as Download,
  IconPlayerPause as Pause,
  IconPlayerPlay as Play,
  IconPlayerStop as Stop,
  IconUpload as Upload,
  IconVolumeOff as VolumeOff,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '0:00.0';
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  const core = `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}` : core;
};

const cleanFileName = (value: string) => value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\.[^.]+$/, '').trim() || 'OrbiDoc_Clip';

const seekTo = (video: HTMLVideoElement, time: number) => new Promise<void>((resolve, reject) => {
  const done = () => { cleanup(); resolve(); };
  const failed = () => { cleanup(); reject(new Error('Não foi possível posicionar o vídeo no ponto de corte.')); };
  const cleanup = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', failed); };
  video.addEventListener('seeked', done, { once: true });
  video.addEventListener('error', failed, { once: true });
  video.currentTime = Math.max(0, Math.min(time, Number.isFinite(video.duration) ? video.duration : time));
  if (Math.abs(video.currentTime - time) < 0.03 && video.readyState >= 2) done();
});

const captureSupport = () => {
  if (typeof window === 'undefined') return false;
  const proto = HTMLMediaElement.prototype as any;
  return typeof MediaRecorder !== 'undefined' && (typeof proto.captureStream === 'function' || typeof proto.mozCaptureStream === 'function');
};

export const VideoClipEditor: React.FC<{ showNotification?: (message: string, type?: 'success' | 'error') => void }> = ({ showNotification = () => {} }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const exportAbortRef = useRef<(() => void) | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewClip, setPreviewClip] = useState(false);
  const [muteOutput, setMuteOutput] = useState(false);
  const [quality, setQuality] = useState<'balanced' | 'high'>('high');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const supported = useMemo(captureSupport, []);
  const clipDuration = Math.max(0, end - start);

  useEffect(() => () => {
    exportAbortRef.current?.();
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const loadFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|m4v|mov|mkv|ogv)$/i.test(file.name)) {
      showNotification('Selecione um arquivo de vídeo compatível.', 'error');
      return;
    }
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setFileName(file.name);
    setDuration(0); setCurrent(0); setStart(0); setEnd(0); setPreviewClip(false); setExportProgress(0);
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      setPreviewClip(false);
      if (video.paused) await video.play(); else video.pause();
    } catch { showNotification('O navegador não conseguiu reproduzir esse codec.', 'error'); }
  };

  const previewSelection = async () => {
    const video = videoRef.current;
    if (!video || clipDuration <= 0.05) return;
    try {
      await seekTo(video, start);
      setPreviewClip(true);
      await video.play();
    } catch (error: any) { showNotification(error?.message || 'Falha ao pré-visualizar o corte.', 'error'); }
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponível.');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Falha ao gerar frame.')), 'image/jpeg', 0.94));
      saveAs(blob, `${cleanFileName(fileName)}_${current.toFixed(1).replace('.', '-') }s.jpg`);
      showNotification('Frame capturado em JPG.', 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha ao capturar frame.', 'error'); }
  };

  const stopExport = () => exportAbortRef.current?.();

  const exportClip = async () => {
    const video = videoRef.current as (HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }) | null;
    if (!video || !fileUrl || clipDuration <= 0.05) return;
    if (!supported) {
      showNotification('Este navegador não expõe captureStream + MediaRecorder para exportação local. A marcação e prévia continuam funcionando.', 'error');
      return;
    }
    const capture = video.captureStream || video.mozCaptureStream;
    if (!capture) return;
    setExporting(true); setExportProgress(0); setPreviewClip(false);
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let interval = 0;
    let aborted = false;
    try {
      video.pause(); video.playbackRate = 1; video.muted = false;
      await seekTo(video, start);
      stream = capture.call(video);
      if (muteOutput) stream.getAudioTracks().forEach((track) => { stream?.removeTrack(track); track.stop(); });
      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
      ];
      const mimeType = candidates.find((value) => MediaRecorder.isTypeSupported(value)) || '';
      const options: MediaRecorderOptions = {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: quality === 'high' ? 8_000_000 : 4_000_000,
        audioBitsPerSecond: 192_000,
      };
      recorder = new MediaRecorder(stream, options);
      const chunks: BlobPart[] = [];
      const output = new Promise<Blob>((resolve, reject) => {
        recorder!.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder!.onerror = () => reject(new Error('O encoder do navegador falhou durante a exportação.'));
        recorder!.onstop = () => {
          if (aborted) reject(new Error('Exportação interrompida.'));
          else resolve(new Blob(chunks, { type: recorder?.mimeType || mimeType || 'video/webm' }));
        };
      });
      exportAbortRef.current = () => {
        aborted = true;
        video.pause();
        if (recorder?.state !== 'inactive') recorder?.stop();
      };
      recorder.start(500);
      interval = window.setInterval(() => {
        const progress = clipDuration ? (video.currentTime - start) / clipDuration : 0;
        setExportProgress(Math.max(0, Math.min(1, progress)));
        if (video.currentTime >= end - 0.03 || video.ended) {
          video.pause();
          if (recorder?.state !== 'inactive') recorder?.stop();
        }
      }, 100);
      await video.play();
      const blob = await output;
      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
      saveAs(blob, `${cleanFileName(fileName)}_clip_${formatTime(start).replace(/[:.]/g, '-')}_${formatTime(end).replace(/[:.]/g, '-')}.${extension}`);
      setExportProgress(1);
      showNotification(`Clipe exportado em ${extension.toUpperCase()}.`, 'success');
    } catch (error: any) {
      if (!aborted) showNotification(error?.message || 'Falha ao exportar o clipe.', 'error');
    } finally {
      window.clearInterval(interval);
      exportAbortRef.current = null;
      if (recorder?.state !== 'inactive') { try { recorder?.stop(); } catch { /* already stopped */ } }
      stream?.getTracks().forEach((track) => track.stop());
      video.pause();
      setExporting(false);
    }
  };

  return <div className="orbidoc-media-studio max-w-[1500px] mx-auto space-y-4">
    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex flex-col xl:flex-row xl:items-center gap-4"><div className="flex-1"><div className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400"><Cut className="w-4 h-4" /> Editor rápido de vídeo</div><h2 className="mt-1 text-2xl font-black">Cortar, revisar e exportar um trecho</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Edição não destrutiva local: marque início/fim, pré-visualize, capture frames e exporte o trecho quando o WebView/navegador oferecer captura de mídia. Nenhum vídeo é enviado ao servidor.</p></div><input ref={fileRef} type="file" accept="video/*,.mp4,.webm,.m4v,.mov,.mkv,.ogv" className="hidden" onChange={(event) => { loadFile(event.target.files?.[0]); event.target.value = ''; }} /><button onClick={() => fileRef.current?.click()} disabled={exporting} className="h-10 px-3 rounded-xl bg-indigo-600 text-white text-xs font-black inline-flex items-center justify-center gap-2 disabled:opacity-40"><Upload className="w-4 h-4" /> Abrir vídeo</button></div>
    </section>

    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="bg-black min-h-[360px] flex items-center justify-center">{fileUrl ? <video ref={videoRef} src={fileUrl} className="w-full max-h-[620px] object-contain" playsInline onLoadedMetadata={(event) => { const value = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0; setDuration(value); setEnd(value); }} onTimeUpdate={(event) => { const value = event.currentTarget.currentTime; setCurrent(value); if (previewClip && end > start && value >= end - 0.03) { event.currentTarget.pause(); setPreviewClip(false); } }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : <div className="py-28 text-center text-slate-500"><Cut className="w-16 h-16 mx-auto opacity-25" /><div className="mt-4 text-sm font-black">Abra um vídeo para editar</div><div className="mt-1 text-xs">O arquivo permanece no dispositivo.</div></div>}</div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800"><input disabled={!fileUrl || exporting} type="range" min={0} max={Math.max(duration, 0.01)} step="0.05" value={Math.min(current, duration || 0)} onChange={(event) => { const value = Number(event.target.value); setCurrent(value); if (videoRef.current) videoRef.current.currentTime = value; }} className="w-full accent-indigo-600 disabled:opacity-40" /><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[10px] tabular-nums text-slate-400 w-28">{formatTime(current)} / {formatTime(duration)}</span><button onClick={() => void togglePlay()} disabled={!fileUrl || exporting} className="w-10 h-10 rounded-full bg-indigo-600 text-white disabled:opacity-30">{playing ? <Pause className="w-4 h-4 mx-auto" /> : <Play className="w-4 h-4 mx-auto" />}</button><button onClick={() => { if (videoRef.current) videoRef.current.pause(); }} disabled={!fileUrl || exporting} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-30"><Stop className="w-4 h-4 mx-auto" /></button><button onClick={() => void previewSelection()} disabled={!fileUrl || exporting || clipDuration <= 0.05} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black disabled:opacity-30">Prévia do trecho</button><button onClick={() => void captureFrame()} disabled={!fileUrl || exporting} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black inline-flex items-center gap-1.5 disabled:opacity-30"><Camera className="w-4 h-4" /> Frame JPG</button></div></div>
      </section>

      <aside className="space-y-4"><section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"><h3 className="text-sm font-black">Intervalo do corte</h3><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[10px] font-black text-slate-500">Início (s)<input type="number" min={0} max={Math.max(0, end - 0.05)} step="0.1" value={Number(start.toFixed(2))} onChange={(event) => setStart(Math.max(0, Math.min(Number(event.target.value) || 0, Math.max(0, end - 0.05))))} className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs" /></label><label className="text-[10px] font-black text-slate-500">Fim (s)<input type="number" min={Math.min(duration, start + 0.05)} max={duration || undefined} step="0.1" value={Number(end.toFixed(2))} onChange={(event) => setEnd(Math.max(start + 0.05, Math.min(Number(event.target.value) || duration, duration || Number(event.target.value))))} className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs" /></label></div><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => setStart(Math.min(current, Math.max(0, end - 0.05)))} disabled={!fileUrl} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black disabled:opacity-30">Marcar início aqui</button><button onClick={() => setEnd(Math.max(start + 0.05, Math.min(current, duration)))} disabled={!fileUrl} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black disabled:opacity-30">Marcar fim aqui</button></div><div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-950 p-3 text-center"><div className="text-[8px] font-black uppercase text-slate-400">Duração do clipe</div><div className="mt-1 text-xl font-black tabular-nums">{formatTime(clipDuration)}</div></div></section>

      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"><h3 className="text-sm font-black">Exportação local</h3><div className={`mt-2 rounded-xl border px-3 py-2 text-[9px] ${supported ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300' : 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300'}`}>{supported ? 'MediaRecorder + captura de mídia disponíveis neste navegador.' : 'Este navegador não oferece a combinação necessária para regravar o clipe. Prévia e captura de frame continuam disponíveis.'}</div><label className="mt-3 flex items-center justify-between gap-3 text-[10px] font-bold"><span className="inline-flex items-center gap-2"><VolumeOff className="w-4 h-4" /> Remover áudio</span><input type="checkbox" checked={muteOutput} onChange={(event) => setMuteOutput(event.target.checked)} /></label><label className="block mt-3 text-[10px] font-black text-slate-500">Qualidade<select value={quality} onChange={(event) => setQuality(event.target.value as 'balanced' | 'high')} className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs"><option value="high">Alta · ~8 Mbps</option><option value="balanced">Equilibrada · ~4 Mbps</option></select></label>{exporting && <div className="mt-3"><div className="flex justify-between text-[9px] text-slate-400"><span>Exportando em tempo real…</span><span>{Math.round(exportProgress * 100)}%</span></div><div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-600 transition-[width]" style={{ width: `${exportProgress * 100}%` }} /></div></div>}<button onClick={exporting ? stopExport : () => void exportClip()} disabled={!fileUrl || !supported || clipDuration <= 0.05} className={`mt-3 w-full h-11 rounded-xl text-white text-xs font-black inline-flex items-center justify-center gap-2 disabled:opacity-40 ${exporting ? 'bg-rose-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{exporting ? <><Stop className="w-4 h-4" /> Interromper</> : <><Download className="w-4 h-4" /> Exportar trecho</>}</button><p className="mt-2 text-[9px] leading-relaxed text-slate-400">A exportação usa o encoder do próprio navegador e acontece em tempo real; formato e codec finais dependem do dispositivo. Para edição multipista, transições e transcodificação universal será necessário um pipeline WebCodecs/FFmpeg dedicado.</p></section>
      </aside>
    </div>
  </div>;
};
