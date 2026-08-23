import React, { useEffect, useMemo, useState } from 'react';
import {
  IconBraces,
  IconCheck,
  IconCopy,
  IconHash,
  IconKey,
  IconLetterCase,
  IconRefresh,
  IconShieldLock,
  IconTextCaption,
  IconX,
} from '@tabler/icons-react';

const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value);
};

const titleCase = (value: string) => value.toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/g, (part) => part.toLocaleUpperCase('pt-BR'));
const cleanSpaces = (value: string) => value
  .split(/\r?\n/)
  .map((line) => line.replace(/[\t ]+/g, ' ').trimEnd())
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
const uniqueLines = (value: string) => Array.from(new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))).join('\n');
const sortLines = (value: string) => value.split(/\r?\n/).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')).join('\n');

function randomPassword(length: number) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_=?.';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

function digestToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  return digestToHex(await crypto.subtle.digest('SHA-256', bytes));
}

async function sha256File(file: File) {
  return digestToHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / (1024 ** index);
  return `${value.toFixed(index === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

function utf8ToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function base64ToUtf8(value: string) {
  const binary = atob(value.trim());
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

type FileIntegrityInfo = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  hash: string;
};

export const LocalUtilitiesLauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [json, setJson] = useState('');
  const [jsonNotice, setJsonNotice] = useState('');
  const [passwordLength, setPasswordLength] = useState(20);
  const [password, setPassword] = useState(() => randomPassword(20));
  const [hashInput, setHashInput] = useState('');
  const [hash, setHash] = useState('');
  const [fileIntegrity, setFileIntegrity] = useState<FileIntegrityInfo | null>(null);
  const [fileIntegrityNotice, setFileIntegrityNotice] = useState('');
  const [fileIntegrityBusy, setFileIntegrityBusy] = useState(false);
  const [codecInput, setCodecInput] = useState('');
  const [codecOutput, setCodecOutput] = useState('');
  const [codecNotice, setCodecNotice] = useState('');
  const [uuid, setUuid] = useState(() => crypto.randomUUID());
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const openTools = () => setOpen(true);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('orbidoc:open-local-tools', openTools);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('orbidoc:open-local-tools', openTools);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return {
      chars: text.length,
      charsNoSpaces: text.replace(/\s/g, '').length,
      words,
      lines: text ? text.split(/\r?\n/).length : 0,
      readingMinutes: words ? Math.max(1, Math.ceil(words / 200)) : 0,
    };
  }, [text]);

  const confirmCopied = (label: string) => {
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1400);
  };

  const formatJson = (compact = false) => {
    try {
      const parsed = JSON.parse(json);
      setJson(JSON.stringify(parsed, null, compact ? 0 : 2));
      setJsonNotice(compact ? 'JSON minificado.' : 'JSON válido e formatado.');
    } catch {
      setJsonNotice('JSON inválido. Confira vírgulas, aspas e chaves.');
    }
  };

  const createHash = async () => setHash(await sha256(hashInput));

  const verifyFile = async (file?: File) => {
    if (!file) return;
    setFileIntegrity(null);
    setFileIntegrityNotice('');
    if (file.size > 200 * 1024 * 1024) {
      setFileIntegrityNotice('Use um arquivo de até 200 MB. O limite evita pressão excessiva de memória no celular.');
      return;
    }
    setFileIntegrityBusy(true);
    try {
      const hashValue = await sha256File(file);
      setFileIntegrity({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        lastModified: file.lastModified,
        hash: hashValue,
      });
      setFileIntegrityNotice('SHA-256 calculado inteiramente neste dispositivo.');
    } catch {
      setFileIntegrityNotice('Não foi possível calcular o SHA-256 deste arquivo.');
    } finally {
      setFileIntegrityBusy(false);
    }
  };

  const runCodec = (mode: 'base64-encode' | 'base64-decode' | 'url-encode' | 'url-decode') => {
    try {
      const result = mode === 'base64-encode'
        ? utf8ToBase64(codecInput)
        : mode === 'base64-decode'
          ? base64ToUtf8(codecInput)
          : mode === 'url-encode'
            ? encodeURIComponent(codecInput)
            : decodeURIComponent(codecInput);
      setCodecOutput(result);
      setCodecNotice('Processado localmente.');
    } catch {
      setCodecOutput('');
      setCodecNotice(mode === 'base64-decode' ? 'Base64 inválido.' : 'Conteúdo inválido para esta conversão.');
    }
  };

  if (!open) return null;

  return (
    <div className="orbidoc-local-tools-overlay fixed inset-0 z-[190] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="orbidoc-local-tools-title">
      <div className="orbidoc-keyboard-safe-panel w-full sm:max-w-5xl max-h-[min(92dvh,900px)] bg-[#F7F9FC] dark:bg-[#080D18] rounded-t-[28px] sm:rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        <header className="shrink-0 px-4 sm:px-5 py-4 bg-white dark:bg-[#101827] border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EFF4FF] dark:bg-[#0D1E5B]/60 text-[#3157F6] dark:text-[#7AA2FF] flex items-center justify-center"><IconShieldLock className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1"><h2 id="orbidoc-local-tools-title" className="text-sm font-black">Ferramentas locais gratuitas</h2><p className="text-[10px] text-slate-500 dark:text-slate-400">Funcionam offline e não enviam o conteúdo para servidores.</p></div>
          <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar ferramentas locais"><IconX className="w-4 h-4" /></button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 grid xl:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
            <div className="flex items-center gap-2"><IconTextCaption className="w-4 h-4 text-[#3157F6]" /><h3 className="text-xs font-black">Texto</h3></div>
            <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Cole ou digite um texto…" className="w-full min-h-40 resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs outline-none focus:border-[#3157F6]" />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">{[[stats.words, 'Palavras'], [stats.chars, 'Caracteres'], [stats.charsNoSpaces, 'Sem espaços'], [stats.lines, 'Linhas'], [stats.readingMinutes, 'Min leitura']].map(([value, label]) => <div key={String(label)} className="rounded-xl bg-slate-50 dark:bg-slate-900 p-2"><div className="text-xs font-black">{value}</div><div className="text-[8px] text-slate-400">{label}</div></div>)}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button onClick={() => setText(text.toLocaleUpperCase('pt-BR'))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">MAIÚSCULAS</button>
              <button onClick={() => setText(text.toLocaleLowerCase('pt-BR'))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">minúsculas</button>
              <button onClick={() => setText(titleCase(text))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center justify-center gap-1"><IconLetterCase className="w-4 h-4" /> Título</button>
              <button onClick={() => setText(cleanSpaces(text))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Limpar espaços</button>
              <button onClick={() => setText(uniqueLines(text))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Remover duplicadas</button>
              <button onClick={() => setText(sortLines(text))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Ordenar linhas</button>
            </div>
            <button disabled={!text} onClick={() => { void copyText(text); confirmCopied('texto'); }} className="h-9 px-3 rounded-xl border border-[#3157F6]/25 text-[#3157F6] dark:text-[#7AA2FF] text-[9px] font-black inline-flex items-center gap-1.5 disabled:opacity-40">{copied === 'texto' ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />} Copiar texto</button>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
              <div className="flex items-center gap-2"><IconBraces className="w-4 h-4 text-emerald-600" /><h3 className="text-xs font-black">JSON</h3></div>
              <textarea value={json} onChange={(event) => { setJson(event.target.value); setJsonNotice(''); }} placeholder='{"nome":"OrbiDoc"}' className="w-full min-h-28 resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-[10px] outline-none focus:border-emerald-500" />
              <div className="flex flex-wrap gap-2"><button onClick={() => formatJson(false)} className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-[9px] font-black">Formatar / validar</button><button onClick={() => formatJson(true)} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Minificar</button></div>
              {jsonNotice && <div className="text-[9px] text-slate-500 dark:text-slate-400">{jsonNotice}</div>}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
              <div className="flex items-center gap-2"><IconKey className="w-4 h-4 text-violet-600" /><h3 className="text-xs font-black">Senha local segura</h3></div>
              <div className="flex gap-2"><input value={password} readOnly className="min-w-0 flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 font-mono text-[10px]" /><button onClick={() => { void copyText(password); confirmCopied('senha'); }} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Copiar senha">{copied === 'senha' ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}</button></div>
              <label className="flex items-center gap-3 text-[9px] font-bold"><span>Tamanho: {passwordLength}</span><input type="range" min={12} max={48} value={passwordLength} onChange={(event) => setPasswordLength(Number(event.target.value))} className="flex-1 accent-[#6D5EF7]" /></label>
              <button onClick={() => setPassword(randomPassword(passwordLength))} className="h-9 px-3 rounded-xl border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-[9px] font-black inline-flex items-center gap-1.5"><IconRefresh className="w-4 h-4" /> Gerar outra</button>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
              <div className="flex items-center gap-2"><IconHash className="w-4 h-4 text-cyan-600" /><h3 className="text-xs font-black">SHA-256 de texto</h3></div>
              <input value={hashInput} onChange={(event) => setHashInput(event.target.value)} placeholder="Texto para gerar hash" className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-[10px] outline-none focus:border-cyan-500" />
              <button disabled={!hashInput} onClick={() => void createHash()} className="h-9 px-3 rounded-xl bg-cyan-600 text-white text-[9px] font-black disabled:opacity-40">Gerar hash</button>
              {hash && <div className="flex gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-slate-50 dark:bg-slate-950 p-2 text-[8px]">{hash}</code><button onClick={() => { void copyText(hash); confirmCopied('hash'); }} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Copiar hash">{copied === 'hash' ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}</button></div>}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
              <div className="flex items-center gap-2"><IconHash className="w-4 h-4 text-teal-600" /><h3 className="text-xs font-black">Integridade de arquivo</h3></div>
              <p className="text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">Mostra metadados básicos e calcula SHA-256 localmente. Útil para conferir documentos, backups e APKs.</p>
              <label className={`h-10 px-3 rounded-xl border border-dashed border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-[9px] font-black inline-flex items-center justify-center cursor-pointer ${fileIntegrityBusy ? 'opacity-50 pointer-events-none' : ''}`}>
                {fileIntegrityBusy ? 'Calculando…' : 'Selecionar arquivo'}
                <input type="file" className="hidden" disabled={fileIntegrityBusy} onChange={(event) => { void verifyFile(event.target.files?.[0]); event.target.value = ''; }} />
              </label>
              {fileIntegrityNotice && <div className="text-[9px] text-slate-500 dark:text-slate-400">{fileIntegrityNotice}</div>}
              {fileIntegrity && <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 space-y-2">
                <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[8px]"><span className="font-black text-slate-400">Nome</span><span className="break-all">{fileIntegrity.name}</span><span className="font-black text-slate-400">Tamanho</span><span>{formatBytes(fileIntegrity.size)} · {fileIntegrity.size.toLocaleString('pt-BR')} bytes</span><span className="font-black text-slate-400">MIME</span><span className="break-all">{fileIntegrity.type}</span><span className="font-black text-slate-400">Modificado</span><span>{new Date(fileIntegrity.lastModified).toLocaleString('pt-BR')}</span></div>
                <div><div className="text-[8px] font-black text-slate-400 mb-1">SHA-256</div><div className="flex gap-2"><code className="min-w-0 flex-1 break-all text-[8px]">{fileIntegrity.hash}</code><button onClick={() => { void copyText(fileIntegrity.hash); confirmCopied('file-hash'); }} className="w-9 h-9 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Copiar SHA-256 do arquivo">{copied === 'file-hash' ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}</button></div></div>
              </div>}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
              <div className="flex items-center gap-2"><IconBraces className="w-4 h-4 text-[#3157F6]" /><h3 className="text-xs font-black">Base64 e URL</h3></div>
              <textarea value={codecInput} onChange={(event) => { setCodecInput(event.target.value); setCodecNotice(''); }} placeholder="Texto, Base64 ou trecho de URL…" className="w-full min-h-24 resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-[10px] outline-none focus:border-[#3157F6]" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => runCodec('base64-encode')} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">→ Base64</button>
                <button onClick={() => runCodec('base64-decode')} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Base64 → texto</button>
                <button onClick={() => runCodec('url-encode')} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Codificar URL</button>
                <button onClick={() => runCodec('url-decode')} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Decodificar URL</button>
              </div>
              {codecNotice && <div className="text-[9px] text-slate-500 dark:text-slate-400">{codecNotice}</div>}
              {codecOutput && <div className="flex gap-2"><code className="min-w-0 flex-1 whitespace-pre-wrap break-all rounded-xl bg-slate-50 dark:bg-slate-950 p-2 text-[8px]">{codecOutput}</code><button onClick={() => { void copyText(codecOutput); confirmCopied('codec'); }} className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Copiar resultado">{copied === 'codec' ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}</button></div>}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
              <div className="flex items-center gap-2"><IconKey className="w-4 h-4 text-amber-600" /><h3 className="text-xs font-black">UUID v4</h3></div>
              <div className="flex gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-[9px]">{uuid}</code><button onClick={() => { void copyText(uuid); confirmCopied('uuid'); }} className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Copiar UUID">{copied === 'uuid' ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}</button></div>
              <button onClick={() => setUuid(crypto.randomUUID())} className="h-9 px-3 rounded-xl border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-[9px] font-black inline-flex items-center gap-1.5"><IconRefresh className="w-4 h-4" /> Gerar outro UUID</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
