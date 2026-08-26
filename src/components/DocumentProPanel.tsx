import React, { useMemo, useState } from 'react';
import { IconAccessible as Accessible, IconCalendar as Calendar, IconCaseUpper as CaseUpper, IconMessage as Message, IconNotes as Notes, IconPageBreak as PageBreak, IconSection as Section, IconSubscript as Subscript, IconSuperscript as Superscript } from '@tabler/icons-react';

type Props = { showNotification?: (message: string, type?: 'success' | 'error') => void };
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const editor = () => document.querySelector<HTMLElement>('.orbidoc-rich-editor');
const sync = (root: HTMLElement) => root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
const keepEditorSelection = (event: React.PointerEvent<HTMLButtonElement>) => event.preventDefault();

export const DocumentProPanel: React.FC<Props> = ({ showNotification = () => {} }) => {
  const [open, setOpen] = useState(false);
  const [header, setHeader] = useState('');
  const [footer, setFooter] = useState('');
  const [auditNonce, setAuditNonce] = useState(0);
  const audit = useMemo(() => {
    if (!open) return { headings: 0, tables: 0, images: 0, links: 0, comments: 0, warnings: [] as string[] };
    const root = editor(); if (!root) return { headings: 0, tables: 0, images: 0, links: 0, comments: 0, warnings: [] as string[] };
    const headings = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    const warnings: string[] = [];
    let previousLevel = 0;
    headings.forEach((heading) => { const level = Number(heading.tagName.slice(1)); if (previousLevel && level > previousLevel + 1) warnings.push(`Hierarquia salta de H${previousLevel} para H${level}.`); previousLevel = level; });
    root.querySelectorAll('img').forEach((image, index) => { if (!image.getAttribute('alt')?.trim()) warnings.push(`Imagem ${index + 1} sem texto alternativo.`); });
    root.querySelectorAll('a').forEach((link, index) => { if (!link.textContent?.trim()) warnings.push(`Link ${index + 1} sem texto descritivo.`); });
    if (!root.querySelector('h1')) warnings.push('Documento sem Título 1 (H1).');
    return { headings: headings.length, tables: root.querySelectorAll('table').length, images: root.querySelectorAll('img').length, links: root.querySelectorAll('a').length, comments: root.querySelectorAll('.orbidoc-comment').length, warnings };
  }, [open, auditNonce]);

  const applyHeaderFooter = () => {
    const root = editor(); if (!root) return;
    root.querySelectorAll('.orbidoc-doc-header,.orbidoc-doc-footer').forEach((node) => node.remove());
    if (header.trim()) root.insertAdjacentHTML('afterbegin', `<div class="orbidoc-doc-header" style="text-align:center;color:#64748b;font-size:12px">${escapeHtml(header.trim())}</div><hr>`);
    if (footer.trim()) root.insertAdjacentHTML('beforeend', `<hr><div class="orbidoc-doc-footer" style="text-align:center;color:#64748b;font-size:12px">${escapeHtml(footer.trim())}</div>`);
    sync(root); setAuditNonce((value) => value + 1); showNotification('Cabeçalho e rodapé atualizados.', 'success');
  };

  const addComment = () => {
    const root = editor(); const selection = window.getSelection(); const text = selection?.toString() || '';
    if (!root || !selection?.rangeCount || !text.trim() || !root.contains(selection.anchorNode)) { showNotification('Selecione um trecho do documento antes de comentar.', 'error'); return; }
    const note = window.prompt('Comentário:')?.trim(); if (!note) return;
    root.focus(); document.execCommand('insertHTML', false, `<span class="orbidoc-comment" title="${escapeHtml(note)}" style="background-color:#fef3c7">${escapeHtml(text)}</span>`);
    sync(root); setAuditNonce((value) => value + 1); showNotification('Comentário inserido no trecho selecionado.', 'success');
  };

  const addFootnote = () => {
    const root = editor(); if (!root) return;
    const note = window.prompt('Texto da nota de rodapé:')?.trim(); if (!note) return;
    const number = root.querySelectorAll('.orbidoc-footnote').length + 1;
    root.focus(); document.execCommand('insertHTML', false, `<sup>[${number}]</sup>`);
    root.insertAdjacentHTML('beforeend', `<p class="orbidoc-footnote"><sup>[${number}]</sup> ${escapeHtml(note)}</p>`);
    sync(root); setAuditNonce((value) => value + 1); showNotification(`Nota de rodapé ${number} adicionada.`, 'success');
  };

  const createSummary = () => {
    const root = editor(); if (!root) return;
    root.querySelectorAll('.orbidoc-doc-summary').forEach((node) => node.remove());
    const headings = [...root.querySelectorAll('h1,h2,h3')].map((heading) => ({ level: Number(heading.tagName.slice(1)), text: heading.textContent?.trim() || '' })).filter((item) => item.text);
    if (!headings.length) { showNotification('Use Título 1, 2 ou 3 antes de gerar o sumário.', 'error'); return; }
    const list = headings.map((item) => `<li style="margin-left:${(item.level - 1) * 18}px">${escapeHtml(item.text)}</li>`).join('');
    root.insertAdjacentHTML('afterbegin', `<div class="orbidoc-doc-summary"><h2>Sumário</h2><ol>${list}</ol></div><hr>`);
    sync(root); setAuditNonce((value) => value + 1); showNotification('Sumário estrutural atualizado.', 'success');
  };

  const runEditorCommand = (command: string, value?: string) => {
    const root = editor(); if (!root) return;
    root.focus();
    document.execCommand(command, false, value);
    sync(root);
  };

  const insertPageBreak = () => {
    runEditorCommand('insertHTML', '<div class="orbidoc-page-break" style="break-after:page;page-break-after:always;height:1px;border-top:1px dashed #cbd5e1;margin:24px 0" aria-label="Quebra de página"></div><p><br></p>');
    showNotification('Quebra de página inserida.', 'success');
  };

  const insertDateTime = () => {
    const now = new Date();
    runEditorCommand('insertText', `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
  };

  const transformSelection = (mode: 'upper' | 'lower') => {
    const root = editor(); const selection = window.getSelection(); const text = selection?.toString() || '';
    if (!root || !selection?.rangeCount || !text || !root.contains(selection.anchorNode)) { showNotification('Selecione um trecho para alterar maiúsculas/minúsculas.', 'error'); return; }
    root.focus();
    document.execCommand('insertText', false, mode === 'upper' ? text.toLocaleUpperCase('pt-BR') : text.toLocaleLowerCase('pt-BR'));
    sync(root);
  };

  return <section className="mb-3 rounded-2xl border border-sky-200/70 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/10 overflow-hidden">
    <button onClick={() => { setOpen((value) => !value); setAuditNonce((value) => value + 1); }} className="w-full min-h-11 px-3 sm:px-4 flex items-center gap-2 text-left"><Section className="w-4 h-4 text-sky-600" /><span className="text-xs font-black">Documento Pro</span><span className="text-[9px] text-slate-500 dark:text-slate-400">Estrutura · revisão · inserções · acessibilidade</span><span className="ml-auto text-[10px] font-black text-sky-700 dark:text-sky-300">{open ? 'Recolher' : 'Abrir'}</span></button>
    {open && <div className="p-3 sm:p-4 border-t border-sky-200/60 dark:border-sky-900 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="text-[10px] font-black">Cabeçalho & rodapé</div><input value={header} onChange={(event) => setHeader(event.target.value)} placeholder="Cabeçalho" className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[9px]" /><input value={footer} onChange={(event) => setFooter(event.target.value)} placeholder="Rodapé" className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[9px]" /><button onPointerDown={keepEditorSelection} onClick={applyHeaderFooter} className="mt-2 w-full h-9 rounded-lg bg-sky-600 text-white text-[9px] font-black">Aplicar ao documento</button></div>
      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Message className="w-4 h-4 text-amber-600" /> Revisão</div><p className="mt-2 text-[9px] text-slate-500">Selecione um trecho no editor e adicione um comentário persistente. O texto fica destacado e o comentário aparece como tooltip.</p><button onPointerDown={keepEditorSelection} onClick={addComment} className="mt-2 w-full h-9 rounded-lg bg-amber-500 text-white text-[9px] font-black">Comentar seleção</button><button onPointerDown={keepEditorSelection} onClick={addFootnote} className="mt-2 w-full h-9 rounded-lg border text-[9px] font-black inline-flex items-center justify-center gap-1"><Notes className="w-3.5 h-3.5" /> Inserir nota de rodapé</button></div>
      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="text-[10px] font-black">Sumário estrutural</div><p className="mt-2 text-[9px] text-slate-500">Lê Títulos 1–3 e cria uma lista hierárquica no início, sem alterar o restante do documento.</p><button onPointerDown={keepEditorSelection} onClick={createSummary} className="mt-3 w-full h-9 rounded-lg bg-violet-600 text-white text-[9px] font-black">Gerar / atualizar sumário</button></div>
      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Calendar className="w-4 h-4 text-blue-600" /> Inserções rápidas</div><div className="mt-2 grid grid-cols-2 gap-1.5"><button onPointerDown={keepEditorSelection} onClick={insertPageBreak} className="min-h-9 rounded-lg border text-[8px] font-black inline-flex items-center justify-center gap-1"><PageBreak className="w-3.5 h-3.5" /> Página</button><button onPointerDown={keepEditorSelection} onClick={insertDateTime} className="min-h-9 rounded-lg border text-[8px] font-black">Data/hora</button><button onPointerDown={keepEditorSelection} onClick={() => runEditorCommand('superscript')} className="min-h-9 rounded-lg border text-[8px] font-black inline-flex items-center justify-center gap-1"><Superscript className="w-3.5 h-3.5" /> Sobrescrito</button><button onPointerDown={keepEditorSelection} onClick={() => runEditorCommand('subscript')} className="min-h-9 rounded-lg border text-[8px] font-black inline-flex items-center justify-center gap-1"><Subscript className="w-3.5 h-3.5" /> Subscrito</button><button onPointerDown={keepEditorSelection} onClick={() => transformSelection('upper')} className="min-h-9 rounded-lg border text-[8px] font-black inline-flex items-center justify-center gap-1"><CaseUpper className="w-3.5 h-3.5" /> MAIÚSC.</button><button onPointerDown={keepEditorSelection} onClick={() => transformSelection('lower')} className="min-h-9 rounded-lg border text-[8px] font-black">minúsc.</button></div></div>
      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Accessible className="w-4 h-4 text-emerald-600" /> Auditoria</div><div className="mt-2 grid grid-cols-3 gap-1 text-center"><span className="rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-[8px]">{audit.headings} títulos</span><span className="rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-[8px]">{audit.images} imagens</span><span className="rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-[8px]">{audit.tables} tabelas</span><span className="rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-[8px]">{audit.links} links</span><span className="rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-[8px]">{audit.comments} comentários</span><button onClick={() => setAuditNonce((value) => value + 1)} className="rounded-lg border p-1 text-[8px] font-black">Revisar</button></div><div className="mt-2 max-h-24 overflow-auto space-y-1">{audit.warnings.map((warning, index) => <div key={`${warning}:${index}`} className="text-[8px] text-amber-700 dark:text-amber-300">• {warning}</div>)}{!audit.warnings.length && <div className="text-[9px] text-emerald-600 font-black">Estrutura sem alertas básicos.</div>}</div></div>
    </div>}
  </section>;
};