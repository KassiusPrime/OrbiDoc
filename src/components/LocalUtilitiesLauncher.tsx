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

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const LocalUtilitiesLauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [json, setJson] = useState('');
  const [jsonNotice, setJsonNotice] = useState('');
  const [passwordLength, setPasswordLength] = useState(20);
  const [password, setPassword] = useState(() => randomPassword(20));
  const [hashInput, setHashInput] = useState('');
  const [hash, setHash] = useState('');
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

  const stats = useMemo(() => {
    const trimmed = text.trim();
    return {
      chars: text.length,
      charsNoSpaces: text.replace(/\s/g, '').length,
      words: trimmed ? trimmed.split(/\s+/).length : 0,
      lines: text ? text.split(/\r?\n/).length : 0,
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
            <div className="grid grid-cols-4 gap-2 text-center">{[[stats.words, 'Palavras'], [stats.chars, 'Caracteres'], [stats.charsNoSpaces, 'Sem espaços'], [stats.lines, 'Linhas']].map(([value, label]) => <div key={String(label)} className="rounded-xl bg-slate-50 dark:bg-slate-900 p-2"><div className="text-xs font-black">{value}</div><div className="text-[8px] text-slate-400">{label}</div></div>)}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button onClick={() => setText(text.toLocaleUpperCase('pt-BR'))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">MAIÚSCULAS</button>
              <button onClick={() => setText(text.toLocaleLowerCase('pt-BR'))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">minúsculas</button>
              <button onClick={() => setText(titleCase(text))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black inline-flex items-center justify-center gap-1"><IconLetterCase className="w-4 h-4" /> Título</button>
              <button onClick={() => setText(cleanSpaces(text))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Limpar espaços</button>
              <button onClick={() => setText(uniqueLines(text))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Remover duplicadas</button>
              <button onClick={() => setText(sortLines(text))} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Ordenar linhas</button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
              <div className="flex items-center gap-2"><IconBraces className="w-4 h-4 text-emerald-600" /><h3 className="text-xs font-black">JSON</h3></div>
              <textarea value={json} onChange={(event) => { setJson(event.target.value); setJsonNotice(''); }} placeholder='{"nome":"OrbiDoc"}' className="w-full min-h-28 resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-[10px] outline-none focus:border-emerald-500" />
              <div className="flex gap-2"><button onClick={() => formatJson(false)} className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-[9px] font-black">Formatar / validar</button><button onClick={() => formatJson(true)} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">Minificar</button></div>
              {jsonNotice && <div className="text-[9px] text-slate-500 dark:text-slate-400">{jsonNotice}</div>}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
              <div className="flex items-center gap-2"><IconKey className="w-4 h-4 text-violet-600" /><h3 className="text-xs font-black">Senha local segura</h3></div>
              <div className="flex gap-2"><input value={password} readOnly className="min-w-0 flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 font-mono text-[10px]" /><button onClick={() => { void copyText(password); confirmCopied('senha'); }} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Copiar senha">{copied === 'senha' ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}</button></div>
              <label className="flex items-center gap-3 text-[9px] font-bold"><span>Tamanho: {passwordLength}</span><input type="range" min={12} max={48} value={passwordLength} onChange={(event) => setPasswordLength(Number(event.target.value))} className="flex-1 accent-[#6D5EF7]" /></label>
              <button onClick={() => setPassword(randomPassword(passwordLength))} className="h-9 px-3 rounded-xl border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-[9px] font-black inline-flex items-center gap-1.5"><IconRefresh className="w-4 h-4" /> Gerar outra</button>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
              <div className="flex items-center gap-2"><IconHash className="w-4 h-4 text-cyan-600" /><h3 className="text-xs font-black">SHA-256</h3></div>
              <input value={hashInput} onChange={(event) => setHashInput(event.target.value)} placeholder="Texto para gerar hash" className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-[10px] outline-none focus:border-cyan-500" />
              <button disabled={!hashInput} onClick={() => void createHash()} className="h-9 px-3 rounded-xl bg-cyan-600 text-white text-[9px] font-black disabled:opacity-40">Gerar hash</button>
              {hash && <div className="flex gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-slate-50 dark:bg-slate-950 p-2 text-[8px]">{hash}</code><button onClick={() => { void copyText(hash); confirmCopied('hash'); }} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Copiar hash">{copied === 'hash' ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}</button></div>}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
