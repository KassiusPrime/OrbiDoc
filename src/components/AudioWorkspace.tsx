import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCopy as Copy,
  IconDownload as Download,
  IconMicrophone as Microphone,
  IconPlayerPause as Pause,
  IconPlayerPlay as Play,
  IconPlayerStop as Stop,
  IconRefresh as Refresh,
  IconSparkles as Sparkles,
  IconVolume as Volume,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import { sendToVercel } from '../api/chat';
import { HistoryItem } from '../types';

interface AudioWorkspaceProps {
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  onSendToWord?: (text: string) => void;
  engineProvider?: string;
  engineModel?: string;
}

type SpeechRecognitionCtor = new () => any;

export const AudioWorkspace: React.FC<AudioWorkspaceProps> = ({
  showNotification = () => {},
  onSaveToHistory,
  onSendToWord,
  engineProvider = 'gemini',
  engineModel = 'gemini-3.6-flash',
}) => {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('pt-BR');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [voiceName, setVoiceName] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const recognitionRef = useRef<any>(null);

  const recognitionCtor = useMemo<SpeechRecognitionCtor | null>(() => {
    if (typeof window === 'undefined') return null;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  }, []);

  useEffect(() => {
    const load = () => {
      const next = window.speechSynthesis?.getVoices?.() || [];
      setVoices(next);
      if (!voiceName && next.length) {
        const preferred = next.find((voice) => voice.lang.toLowerCase().startsWith(language.toLowerCase().slice(0, 2))) || next[0];
        setVoiceName(preferred.name);
      }
    };
    load();
    window.speechSynthesis?.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', load);
  }, [language]);

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel?.();
  }, []);

  const speak = () => {
    if (!('speechSynthesis' in window)) {
      showNotification('Síntese de voz não é suportada neste navegador.', 'error');
      return;
    }
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = rate;
    utterance.pitch = pitch;
    const voice = voices.find((item) => item.name === voiceName);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const pauseResume = () => {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    else window.speechSynthesis.pause();
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const startListening = () => {
    if (!recognitionCtor) {
      showNotification('Reconhecimento de fala ao vivo não é suportado neste navegador. O OrbiDoc não simula uma transcrição quando a API não existe.', 'error');
      return;
    }
    const recognition = new recognitionCtor();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => { setListening(false); setInterim(''); recognitionRef.current = null; };
    recognition.onerror = (event: any) => {
      if (event?.error !== 'aborted') showNotification(`Reconhecimento de fala: ${event?.error || 'falha'}.`, 'error');
    };
    recognition.onresult = (event: any) => {
      let finalText = '';
      let temp = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) finalText += transcript;
        else temp += transcript;
      }
      if (finalText) setText((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${finalText}`);
      setInterim(temp);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => recognitionRef.current?.stop?.();

  const cleanWithAi = async () => {
    if (!text.trim()) return;
    setAiBusy(true);
    try {
      const answer = await sendToVercel(engineProvider, engineModel, [
        { role: 'system', content: 'Revise esta transcrição de fala. Corrija pontuação, capitalização e repetições óbvias sem mudar o significado, nomes ou fatos. Retorne somente o texto revisado.' },
        { role: 'user', content: text },
      ]);
      setText(answer);
      onSaveToHistory?.({ type: 'audio', title: 'Transcrição revisada', summary: answer.slice(0, 180), details: answer, tags: ['Áudio', 'Transcrição', 'IA'] });
      showNotification('Transcrição revisada.', 'success');
    } catch (error: any) {
      showNotification(error?.message || 'Falha ao revisar transcrição.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const downloadText = () => {
    if (!text.trim()) return;
    saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), `OrbiDoc_Transcricao_${new Date().toISOString().slice(0, 10)}.txt`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400"><Volume className="w-4 h-4" /> Áudio & fala</div>
            <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Ouvir texto e ditar ao vivo</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Usa as APIs de voz do próprio dispositivo. Quando o navegador não oferece reconhecimento de fala, o OrbiDoc informa a limitação em vez de inventar uma transcrição.</p>
          </div>
          <select value={language} onChange={(event) => setLanguage(event.target.value)} className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-bold"><option value="pt-BR">Português (Brasil)</option><option value="en-US">English (US)</option><option value="es-ES">Español</option><option value="fr-FR">Français</option><option value="de-DE">Deutsch</option></select>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"><div><h2 className="text-sm font-black">Texto / transcrição</h2><p className="text-[10px] text-slate-500 mt-0.5">Edite livremente antes de ouvir ou exportar.</p></div><span className="text-[10px] text-slate-400">{text.length} caracteres</span></div>
          <div className="p-4"><textarea value={text} onChange={(event) => setText(event.target.value)} rows={18} className="w-full min-h-[380px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 text-sm leading-relaxed outline-none focus:border-indigo-500" placeholder="Digite um texto ou use o microfone para ditar…" />{interim && <div className="mt-2 text-xs italic text-slate-400">Ouvindo: {interim}</div>}</div>
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {!listening ? <button onClick={startListening} className="h-10 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black inline-flex items-center gap-2"><Microphone className="w-4 h-4" /> Ditar ao vivo</button> : <button onClick={stopListening} className="h-10 px-3 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-black inline-flex items-center gap-2"><Stop className="w-4 h-4" /> Parar ditado</button>}
            <button onClick={cleanWithAi} disabled={aiBusy || !text.trim()} className="h-10 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-black inline-flex items-center gap-2 disabled:opacity-40"><Sparkles className="w-4 h-4" />{aiBusy ? 'Revisando…' : 'Revisar com IA'}</button>
            <button onClick={() => navigator.clipboard.writeText(text)} disabled={!text.trim()} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-2 disabled:opacity-40"><Copy className="w-4 h-4" /> Copiar</button>
            <button onClick={downloadText} disabled={!text.trim()} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-2 disabled:opacity-40"><Download className="w-4 h-4" /> TXT</button>
            {onSendToWord && <button onClick={() => onSendToWord(text)} disabled={!text.trim()} className="h-10 px-3 rounded-xl border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold disabled:opacity-40">Abrir em Documentos</button>}
          </div>
        </section>

        <aside className="lg:col-span-4 space-y-4">
          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="text-sm font-black">Leitura em voz alta</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A voz disponível depende do sistema operacional e navegador.</p>
            <label className="block mt-4 text-[10px] font-black text-slate-500">Voz<select value={voiceName} onChange={(event) => setVoiceName(event.target.value)} className="mt-1 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs">{voices.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>)}</select></label>
            <label className="block mt-3 text-[10px] font-black text-slate-500">Velocidade: {rate.toFixed(1)}×<input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={(event) => setRate(Number(event.target.value))} className="mt-2 w-full" /></label>
            <label className="block mt-3 text-[10px] font-black text-slate-500">Tom: {pitch.toFixed(1)}<input type="range" min="0.5" max="2" step="0.1" value={pitch} onChange={(event) => setPitch(Number(event.target.value))} className="mt-2 w-full" /></label>
            <div className="mt-4 grid grid-cols-3 gap-2"><button onClick={speak} disabled={!text.trim()} className="h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-40" title="Ouvir"><Play className="w-4 h-4" /></button><button onClick={pauseResume} disabled={!speaking} className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40" title="Pausar/continuar"><Pause className="w-4 h-4" /></button><button onClick={stopSpeaking} disabled={!speaking} className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40" title="Parar"><Stop className="w-4 h-4" /></button></div>
          </section>

          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"><div className="flex items-center gap-2"><Refresh className="w-4 h-4 text-slate-500" /><h3 className="text-xs font-black">Compatibilidade</h3></div><div className="mt-3 space-y-2 text-[11px]"><div className="flex justify-between"><span className="text-slate-500">Síntese de voz</span><strong className={'speechSynthesis' in window ? 'text-emerald-600' : 'text-rose-600'}>{'speechSynthesis' in window ? 'Disponível' : 'Indisponível'}</strong></div><div className="flex justify-between"><span className="text-slate-500">Ditado ao vivo</span><strong className={recognitionCtor ? 'text-emerald-600' : 'text-amber-600'}>{recognitionCtor ? 'Disponível' : 'Não suportado'}</strong></div></div></section>
        </aside>
      </div>
    </div>
  );
};
