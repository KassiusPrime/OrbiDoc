import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Download, Languages, Mic, Pause, Play, Square, Sparkles, Upload, Volume2 } from 'lucide-react';
import { saveAs } from 'file-saver';
import { sendToVercel } from '../api/chat';
import { orbitApiUrl } from '../lib/orbitApiOrigin';
import type { HistoryItem } from '../types';

export interface VoiceStudioWorkspaceProps {
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  onSendToWord?: (text: string) => void;
}

type VoiceStatus = { enabled: boolean; available: boolean; version?: string; capabilities?: { tts?: boolean; stt?: boolean } };

export const VoiceStudioWorkspace: React.FC<VoiceStudioWorkspaceProps> = ({ showNotification = () => {}, onSaveToHistory, onSendToWord }) => {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('pt-BR');
  const [voice, setVoice] = useState('');
  const [voices, setVoices] = useState<Array<{ id?: string; name?: string; language?: string; preview_url?: string }>>([]);
  const [speed, setSpeed] = useState(1);
  const [status, setStatus] = useState<VoiceStatus>({ enabled: false, available: false });
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(orbitApiUrl('/api/voice/status')).then(async (r) => ({ ok: r.ok, data: await r.json() as VoiceStatus })).catch(() => ({ ok: false, data: { enabled: false, available: false } })),
      fetch(orbitApiUrl('/api/voice/voices')).then(async (r) => r.ok ? await r.json() : { data: [] }).catch(() => ({ data: [] })),
    ]).then(([runtime, voiceData]) => {
      if (!active) return;
      setStatus(runtime.data);
      const list = Array.isArray(voiceData) ? voiceData : Array.isArray((voiceData as any)?.data) ? (voiceData as any).data : Array.isArray((voiceData as any)?.voices) ? (voiceData as any).voices : [];
      setVoices(list);
      if (list[0]?.id) setVoice(String(list[0].id));
    });
    return () => { active = false; if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, []);

  const synthesize = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(orbitApiUrl('/api/voice/speech'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), voice: voice || undefined, speed, response_format: 'mp3' }),
      });
      if (!response.ok) throw new Error((await response.text()) || 'Falha ao gerar áudio.');
      const blob = await response.blob();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(blob));
      showNotification('Áudio gerado.', 'success');
    } catch (error) { showNotification(error instanceof Error ? error.message : 'VoiceStudio indisponível.', 'error'); }
    finally { setBusy(false); }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { showNotification('Este navegador não suporta gravação de áudio.', 'error'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunks.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: recorder.mimeType || 'audio/webm' });
        const form = new FormData();
        form.append('file', blob, 'orbit-dictation.webm');
        form.append('language', language);
        form.append('response_format', 'json');
        setTranscribing(true);
        try {
          const response = await fetch(orbitApiUrl('/api/voice/transcriptions'), { method: 'POST', body: form });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(String(data.error?.message || data.error || 'Falha na transcrição.'));
          const transcript = String(data.text || '');
          if (transcript) setText((current) => current ? `${current.trim()} ${transcript}` : transcript);
          showNotification('Transcrição concluída.', 'success');
        } catch (error) { showNotification(error instanceof Error ? error.message : 'Falha na transcrição.', 'error'); }
        finally { setTranscribing(false); }
      };
      mediaRecorder.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (error) { showNotification(error instanceof Error ? error.message : 'Não foi possível acessar o microfone.', 'error'); }
  };

  const stopRecording = () => { mediaRecorder.current?.stop(); setRecording(false); };

  const refine = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const models = await fetch(orbitApiUrl('/api/ai/models')).then((r) => r.json());
      const model = Array.isArray(models.models) && models.models[0]?.name ? String(models.models[0].name) : 'llama3.2:3b';
      const answer = await sendToVercel('local', model, [
        { role: 'system', content: 'Revise a transcrição. Corrija pontuação, capitalização e repetições óbvias sem mudar significado, nomes ou fatos. Retorne somente o texto revisado.' },
        { role: 'user', content: text },
      ]);
      setText(answer);
      onSaveToHistory?.({ type: 'audio', title: 'Transcrição revisada', summary: answer.slice(0, 180), details: answer, tags: ['Áudio', 'Transcrição', 'IA local'] });
      showNotification('Transcrição revisada pelo Ollama.', 'success');
    } catch (error) { showNotification(error instanceof Error ? error.message : 'Falha ao revisar.', 'error'); }
    finally { setBusy(false); }
  };

  const downloadText = () => { if (text.trim()) saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), `Orbit_Transcricao_${new Date().toISOString().slice(0, 10)}.txt`); };

  return <div className="h-full min-h-0 flex flex-col bg-white dark:bg-[#111318]">
    <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2"><AudioLines className="h-5 w-5 text-violet-500" /><div><h2 className="text-sm font-black">Voz</h2><p className="text-[10px] text-slate-500">VoiceStudio self-hosted · TTS / STT</p></div></div>
      <span className={`ml-auto text-[10px] font-bold ${status.available ? 'text-emerald-600' : 'text-amber-600'}`}>{status.available ? `Disponível${status.version ? ` · ${status.version}` : ''}` : 'VoiceStudio indisponível'}</span>
    </div>
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]">
      <main className="min-h-0 p-4 flex flex-col">
        <textarea value={text} onChange={(e) => setText(e.target.value)} className="flex-1 min-h-[320px] w-full resize-none border-0 outline-none bg-transparent text-sm leading-7" placeholder="Digite um texto ou grave uma transcrição…" />
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex flex-wrap gap-2">
          {!recording ? <button onClick={startRecording} disabled={!status.available || transcribing} className="h-9 px-3 rounded-md bg-violet-600 text-white text-xs font-bold inline-flex items-center gap-2 disabled:opacity-40"><Mic className="h-4 w-4" /> {transcribing ? 'Transcrevendo…' : 'Ditar'}</button> : <button onClick={stopRecording} className="h-9 px-3 rounded-md bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-2"><Square className="h-3.5 w-3.5" /> Parar</button>}
          <button onClick={refine} disabled={!text.trim() || busy} className="h-9 px-3 rounded-md bg-violet-50 text-violet-700 text-xs font-bold inline-flex items-center gap-2 disabled:opacity-40"><Sparkles className="h-4 w-4" /> Revisar com IA</button>
          <button onClick={downloadText} disabled={!text.trim()} className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-2 disabled:opacity-40"><Download className="h-4 w-4" /> TXT</button>
          {onSendToWord && <button onClick={() => onSendToWord(text)} disabled={!text.trim()} className="h-9 px-3 rounded-md border border-slate-200 text-xs font-bold disabled:opacity-40">Enviar para Documento</button>}
        </div>
      </main>
      <aside className="border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 p-4 space-y-4 overflow-auto">
        <div><label className="text-[10px] font-black text-slate-500 flex items-center gap-1"><Languages className="h-3.5 w-3.5" /> Idioma</label><select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="pt-BR">Português (Brasil)</option><option value="en-US">English</option><option value="es-ES">Español</option></select></div>
        <div><label className="text-[10px] font-black text-slate-500 flex items-center gap-1"><Volume2 className="h-3.5 w-3.5" /> Voz</label><select value={voice} onChange={(e) => setVoice(e.target.value)} disabled={!voices.length} className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-xs">{voices.length ? voices.map((item, i) => <option key={String(item.id || i)} value={String(item.id || '')}>{String(item.name || item.id || `Voz ${i + 1}`)}</option>) : <option>VoiceStudio não disponível</option>}</select></div>
        <div><label className="text-[10px] font-black text-slate-500">Velocidade: {speed.toFixed(1)}×</label><input className="mt-2 w-full" type="range" min="0.5" max="2" step="0.1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /></div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={synthesize} disabled={!status.available || !text.trim() || busy} className="h-9 rounded-md bg-violet-600 text-white text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40"><Play className="h-4 w-4" /> Gerar</button>
          <button onClick={() => audioUrl && document.querySelector<HTMLAudioElement>('#orbit-voice-audio')?.pause()} disabled={!audioUrl} className="h-9 rounded-md border text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40"><Pause className="h-4 w-4" /> Pausar</button>
        </div>
        {audioUrl ? <audio id="orbit-voice-audio" className="w-full" controls src={audioUrl} /> : <div className="text-[11px] text-slate-500 border border-dashed border-slate-300 rounded-md p-4 text-center">O áudio gerado aparecerá aqui.</div>}
      </aside>
    </div>
  </div>;
};
