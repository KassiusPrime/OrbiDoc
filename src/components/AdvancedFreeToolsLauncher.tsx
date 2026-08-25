import React, { useEffect, useMemo, useState } from 'react';
import {
  IconArrowsDiff,
  IconBraces,
  IconCheck,
  IconCopy,
  IconDownload,
  IconPhoto,
  IconRegex,
  IconShieldLock,
  IconX,
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';

type CsvRow = string[];
type ImageOutput = 'image/png' | 'image/jpeg' | 'image/webp';

const copyText = async (value: string) => navigator.clipboard.writeText(value);

function parseCsv(input: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }

  if (quoted) throw new Error('CSV inválido: há aspas abertas sem fechamento.');
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.length > 0));
}

function csvToJson(input: string) {
  const rows = parseCsv(input);
  if (rows.length < 2) throw new Error('O CSV precisa de cabeçalho e pelo menos uma linha de dados.');
  const headers = rows[0].map((header, index) => header.trim() || `coluna_${index + 1}`);
  const objects = rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
  return JSON.stringify(objects, null, 2);
}

function csvCell(value: unknown) {
  const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function jsonToCsv(input: string) {
  const parsed = JSON.parse(input) as unknown;
  if (!Array.isArray(parsed) || !parsed.length || parsed.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('Use um JSON contendo um array de objetos.');
  }
  const records = parsed as Array<Record<string, unknown>>;
  const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  const rows = [headers.map(csvCell).join(',')];
  records.forEach((record) => rows.push(headers.map((header) => csvCell(record[header])).join(',')));
  return rows.join('\n');
}

function fileBaseName(name: string) {
  return name.replace(/\.[^/.]+$/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'OrbiDoc';
}

async function decodeImage(file: File) {
  if ('createImageBitmap' in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Não foi possível decodificar esta imagem.'));
      element.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function stripImageMetadata(file: File, outputType: ImageOutput): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem raster válida.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Use uma imagem de até 50 MB para preservar a memória do dispositivo.');

  const image = await decodeImage(file);
  const width = image.width;
  const height = image.height;
  if (!width || !height || width * height > 64_000_000) {
    if ('close' in image && typeof image.close === 'function') image.close();
    throw new Error('A resolução é grande demais para uma limpeza segura neste dispositivo.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: outputType !== 'image/jpeg' });
  if (!context) throw new Error('Canvas 2D indisponível neste dispositivo.');
  if (outputType === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  if ('close' in image && typeof image.close === 'function') image.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Não foi possível reexportar a imagem.')), outputType, 0.96);
  });
  return { blob, width, height };
}

export const AdvancedFreeToolsLauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');
  const [csvInput, setCsvInput] = useState('');
  const [csvOutput, setCsvOutput] = useState('');
  const [csvNotice, setCsvNotice] = useState('');
  const [regexPattern, setRegexPattern] = useState('');
  const [regexFlags, setRegexFlags] = useState('gi');
  const [regexText, setRegexText] = useState('');
  const [regexNotice, setRegexNotice] = useState('');
  const [regexMatches, setRegexMatches] = useState<string[]>([]);
  const [imageOutput, setImageOutput] = useState<ImageOutput>('image/png');
  const [imageNotice, setImageNotice] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const openTools = () => setOpen(true);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('orbidoc:open-advanced-tools', openTools);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('orbidoc:open-advanced-tools', openTools);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const diff = useMemo(() => {
    const left = leftText.split(/\r?\n/);
    const right = rightText.split(/\r?\n/);
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    const removed = left.filter((line) => line && !rightSet.has(line));
    const added = right.filter((line) => line && !leftSet.has(line));
    const same = right.filter((line) => line && leftSet.has(line)).length;
    return { added, removed, same };
  }, [leftText, rightText]);

  const confirmCopied = (label: string) => {
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1300);
  };

  const convertCsv = (mode: 'csv-json' | 'json-csv') => {
    try {
      const output = mode === 'csv-json' ? csvToJson(csvInput) : jsonToCsv(csvInput);
      setCsvOutput(output);
      setCsvNotice(mode === 'csv-json' ? 'CSV convertido para JSON localmente.' : 'JSON convertido para CSV localmente.');
    } catch (error) {
      setCsvOutput('');
      setCsvNotice(error instanceof Error ? error.message : 'Não foi possível converter os dados.');
    }
  };

  const testRegex = () => {
    setRegexMatches([]);
    try {
      const flags = Array.from(new Set(regexFlags.replace(/[^dgimsuvy]/g, '').split(''))).join('');
      const iterationFlags = flags.includes('g') ? flags : `${flags}g`;
      const expression = new RegExp(regexPattern, iterationFlags);
      const matches = Array.from(regexText.matchAll(expression)).slice(0, 200).map((match, index) => `${index + 1}. ${match[0]}${match.index != null ? ` · posição ${match.index}` : ''}`);
      setRegexMatches(matches);
      setRegexNotice(matches.length ? `${matches.length}${matches.length === 200 ? '+' : ''} ocorrência(s) encontrada(s).` : 'Nenhuma ocorrência encontrada.');
    } catch (error) {
      setRegexNotice(error instanceof Error ? error.message : 'Expressão regular inválida.');
    }
  };

  const cleanImage = async (file?: File) => {
    if (!file) return;
    setImageBusy(true);
    setImageNotice('');
    try {
      const result = await stripImageMetadata(file, imageOutput);
      const extension = imageOutput === 'image/jpeg' ? 'jpg' : imageOutput === 'image/webp' ? 'webp' : 'png';
      saveAs(result.blob, `${fileBaseName(file.name)}-sem-metadados.${extension}`);
      setImageNotice(`Imagem reexportada localmente em ${result.width}×${result.height}. EXIF/GPS e demais metadados não foram copiados para o novo arquivo.`);
    } catch (error) {
      setImageNotice(error instanceof Error ? error.message : 'Falha ao limpar os metadados da imagem.');
    } finally {
      setImageBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="orbidoc-local-tools-overlay fixed inset-0 z-[191] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="orbidoc-advanced-tools-title">
      <div className="orbidoc-keyboard-safe-panel w-full sm:max-w-6xl max-h-[min(92dvh,920px)] bg-[#F7F9FC] dark:bg-[#080D18] rounded-t-[28px] sm:rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        <header className="shrink-0 px-4 sm:px-5 py-4 bg-white dark:bg-[#101827] border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 flex items-center justify-center"><IconShieldLock className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1"><h2 id="orbidoc-advanced-tools-title" className="text-sm font-black">Laboratório gratuito · offline</h2><p className="text-[10px] text-slate-500 dark:text-slate-400">Dados e arquivos permanecem neste dispositivo. Nenhuma API é necessária.</p></div>
          <button type="button" onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center" aria-label="Fechar laboratório gratuito"><IconX className="w-4 h-4" /></button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 grid xl:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
            <div className="flex items-center gap-2"><IconArrowsDiff className="w-4 h-4 text-[#3157F6]" /><h3 className="text-xs font-black">Comparar textos</h3></div>
            <div className="grid sm:grid-cols-2 gap-2"><textarea value={leftText} onChange={(event) => setLeftText(event.target.value)} placeholder="Versão A…" className="min-h-32 resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-[10px] outline-none focus:border-[#3157F6]" /><textarea value={rightText} onChange={(event) => setRightText(event.target.value)} placeholder="Versão B…" className="min-h-32 resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-[10px] outline-none focus:border-[#3157F6]" /></div>
            <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/25 p-2"><div className="text-xs font-black text-emerald-700 dark:text-emerald-300">+{diff.added.length}</div><div className="text-[8px] text-slate-500">Novas</div></div><div className="rounded-xl bg-rose-50 dark:bg-rose-950/25 p-2"><div className="text-xs font-black text-rose-700 dark:text-rose-300">-{diff.removed.length}</div><div className="text-[8px] text-slate-500">Removidas</div></div><div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-2"><div className="text-xs font-black">{diff.same}</div><div className="text-[8px] text-slate-500">Em comum</div></div></div>
            {(diff.added.length > 0 || diff.removed.length > 0) && <div className="grid sm:grid-cols-2 gap-2 text-[9px]"><div className="rounded-xl border border-rose-100 dark:border-rose-900/50 p-2 max-h-36 overflow-auto"><div className="font-black text-rose-600 mb-1">Removidas</div>{diff.removed.slice(0, 80).map((line, index) => <div key={`${line}-${index}`} className="break-words">− {line}</div>)}</div><div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 p-2 max-h-36 overflow-auto"><div className="font-black text-emerald-600 mb-1">Adicionadas</div>{diff.added.slice(0, 80).map((line, index) => <div key={`${line}-${index}`} className="break-words">+ {line}</div>)}</div></div>}
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
            <div className="flex items-center gap-2"><IconBraces className="w-4 h-4 text-emerald-600" /><h3 className="text-xs font-black">CSV ↔ JSON</h3></div>
            <textarea value={csvInput} onChange={(event) => { setCsvInput(event.target.value); setCsvNotice(''); }} placeholder={'nome,email\nAna,ana@exemplo.com'} className="w-full min-h-32 resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-[10px] outline-none focus:border-emerald-500" />
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => convertCsv('csv-json')} className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-[9px] font-black">CSV → JSON</button><button type="button" onClick={() => convertCsv('json-csv')} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[9px] font-black">JSON → CSV</button></div>
            {csvNotice && <div className="text-[9px] text-slate-500 dark:text-slate-400">{csvNotice}</div>}
            {csvOutput && <div className="flex gap-2"><pre className="min-w-0 flex-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 dark:bg-slate-950 p-2 text-[8px]">{csvOutput}</pre><button type="button" onClick={() => { void copyText(csvOutput); confirmCopied('csv'); }} className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Copiar conversão">{copied === 'csv' ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}</button></div>}
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
            <div className="flex items-center gap-2"><IconRegex className="w-4 h-4 text-violet-600" /><h3 className="text-xs font-black">Testar expressão regular</h3></div>
            <div className="grid grid-cols-[minmax(0,1fr)_80px] gap-2"><input value={regexPattern} onChange={(event) => setRegexPattern(event.target.value)} placeholder="\bOrbiDoc\b" className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 font-mono text-[10px] outline-none focus:border-violet-500" /><input value={regexFlags} onChange={(event) => setRegexFlags(event.target.value)} placeholder="gi" className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 font-mono text-[10px] outline-none focus:border-violet-500" aria-label="Flags da expressão regular" /></div>
            <textarea value={regexText} onChange={(event) => setRegexText(event.target.value)} placeholder="Texto para testar…" className="w-full min-h-28 resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-[10px] outline-none focus:border-violet-500" />
            <button type="button" disabled={!regexPattern} onClick={testRegex} className="h-9 px-3 rounded-xl bg-violet-600 text-white text-[9px] font-black disabled:opacity-40">Testar</button>
            {regexNotice && <div className="text-[9px] text-slate-500 dark:text-slate-400">{regexNotice}</div>}
            {regexMatches.length > 0 && <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 dark:bg-slate-950 p-2 text-[8px]">{regexMatches.join('\n')}</pre>}
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] p-4 space-y-3">
            <div className="flex items-center gap-2"><IconPhoto className="w-4 h-4 text-cyan-600" /><h3 className="text-xs font-black">Remover metadados de imagem</h3></div>
            <p className="text-[9px] leading-relaxed text-slate-500 dark:text-slate-400">Reexporta os pixels em um novo arquivo sem copiar EXIF, GPS, modelo de câmera ou outros metadados incorporados. O processamento é local.</p>
            <select value={imageOutput} onChange={(event) => setImageOutput(event.target.value as ImageOutput)} className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-[10px] font-bold"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select>
            <label className={`h-10 px-3 rounded-xl border border-dashed border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-[9px] font-black inline-flex items-center justify-center gap-2 cursor-pointer ${imageBusy ? 'opacity-50 pointer-events-none' : ''}`}><IconDownload className="w-4 h-4" /> {imageBusy ? 'Limpando…' : 'Selecionar e limpar imagem'}<input type="file" accept="image/png,image/jpeg,image/webp,image/bmp" className="hidden" disabled={imageBusy} onChange={(event) => { void cleanImage(event.target.files?.[0]); event.target.value = ''; }} /></label>
            {imageNotice && <div className="rounded-xl bg-cyan-50 dark:bg-cyan-950/25 px-3 py-2 text-[9px] leading-relaxed text-cyan-800 dark:text-cyan-200">{imageNotice}</div>}
          </section>
        </main>
      </div>
    </div>
  );
};
