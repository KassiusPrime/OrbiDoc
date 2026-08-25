import React, { useMemo, useState } from 'react';
import { IconAdjustments as Adjustments, IconFilter as Filter, IconReplace as Replace, IconSparkles as Sparkles, IconSortAscending as SortAscending, IconSortDescending as SortDescending } from '@tabler/icons-react';
import type { SavedProject } from '../types';
import { conditionalFormat, createFilteredSheet, markInvalid, replaceInRange, sortRange, trimRange, validateRange, type ConditionalRule, type ProSheet, type ValidationRule } from '../lib/spreadsheetPro';
import { insertQuickFormula, type QuickFormula } from '../lib/spreadsheetQuickFormula';

type Props = {
  project: SavedProject;
  onProjectChange: (project: SavedProject) => void;
  onApplied: () => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
};

export const SpreadsheetProPanel: React.FC<Props> = ({ project, onProjectChange, onApplied, showNotification = () => {} }) => {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState('A1:D20');
  const [column, setColumn] = useState('A');
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [exact, setExact] = useState(false);
  const [validationKind, setValidationKind] = useState<'nonempty' | 'number' | 'date' | 'list'>('nonempty');
  const [validationArg, setValidationArg] = useState('');
  const [conditionKind, setConditionKind] = useState<'greater' | 'less' | 'equal' | 'contains' | 'nonempty'>('greater');
  const [conditionArg, setConditionArg] = useState('0');
  const [formulaOperation, setFormulaOperation] = useState<QuickFormula>('SUM');
  const [formulaTarget, setFormulaTarget] = useState('F2');

  const workbook = project.content as any;
  const activeSheet = useMemo(() => {
    if (!workbook?.sheets?.length) return null;
    return workbook.sheets.find((sheet: any) => sheet.id === workbook.activeSheetId) || workbook.sheets[0];
  }, [workbook]);

  const persist = (nextWorkbook: any, message: string) => {
    const updated = { ...project, content: nextWorkbook, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(`orbidoc_spreadsheet_v4_${project.id}`, JSON.stringify({ workbook: nextWorkbook, title: project.title, updatedAt: updated.updatedAt })); } catch { /* local storage may be full */ }
    onProjectChange(updated);
    onApplied();
    showNotification(message, 'success');
  };

  const replaceSheet = (nextSheet: ProSheet, message: string) => {
    if (!activeSheet) return;
    const nextWorkbook = { ...workbook, sheets: workbook.sheets.map((sheet: any) => sheet.id === activeSheet.id ? nextSheet : sheet) };
    persist(nextWorkbook, message);
  };

  const filterToNewSheet = () => {
    if (!activeSheet) return;
    const next = createFilteredSheet(activeSheet, range, column, query, exact, true, `Filtro ${column}`);
    if (!next) { showNotification('Intervalo ou coluna de filtro inválidos.', 'error'); return; }
    persist({ ...workbook, sheets: [...workbook.sheets, next], activeSheetId: next.id }, `Nova aba criada com o filtro da coluna ${column.toUpperCase()}.`);
  };

  const runReplace = () => {
    if (!activeSheet || !query) return;
    const result = replaceInRange(activeSheet, range, query, replacement, exact);
    replaceSheet(result.sheet, `${result.replacements} substituição(ões) aplicada(s).`);
  };

  const runValidation = () => {
    if (!activeSheet) return;
    let rule: ValidationRule;
    if (validationKind === 'number') {
      const [minRaw, maxRaw] = validationArg.split(':');
      rule = { kind: 'number', min: minRaw?.trim() ? Number(minRaw.replace(',', '.')) : undefined, max: maxRaw?.trim() ? Number(maxRaw.replace(',', '.')) : undefined };
    } else if (validationKind === 'list') rule = { kind: 'list', values: validationArg.split(',').map((value) => value.trim()).filter(Boolean) };
    else rule = { kind: validationKind } as ValidationRule;
    const invalid = validateRange(activeSheet, range, rule);
    replaceSheet(markInvalid(activeSheet, invalid), invalid.length ? `${invalid.length} célula(s) inválida(s) destacada(s).` : 'Validação concluída sem inconsistências.');
  };

  const runConditional = () => {
    if (!activeSheet) return;
    const rule: ConditionalRule = conditionKind === 'greater' || conditionKind === 'less'
      ? { kind: conditionKind, value: Number(conditionArg.replace(',', '.')) }
      : conditionKind === 'nonempty' ? { kind: 'nonempty' } : { kind: conditionKind, value: conditionArg };
    const result = conditionalFormat(activeSheet, range, rule);
    replaceSheet(result.sheet, `${result.matched} célula(s) formatada(s) pela condição.`);
  };

  const runQuickFormula = () => {
    if (!activeSheet) return;
    const result = insertQuickFormula(activeSheet, range, formulaTarget, formulaOperation);
    if (!result) { showNotification('Intervalo ou célula de destino inválidos.', 'error'); return; }
    replaceSheet(result.sheet, `${result.formula} inserida em ${result.target}.`);
  };

  if (!activeSheet) return null;
  return <section className="mb-3 rounded-2xl border border-emerald-200/70 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/10 overflow-hidden">
    <button onClick={() => setOpen((value) => !value)} className="w-full min-h-11 px-3 sm:px-4 flex items-center gap-2 text-left"><Adjustments className="w-4 h-4 text-emerald-600" /><span className="text-xs font-black">Planilha Pro</span><span className="text-[9px] text-slate-500 dark:text-slate-400">Filtro · validação · condição · fórmulas · limpeza</span><span className="ml-auto text-[10px] font-black text-emerald-700 dark:text-emerald-300">{open ? 'Recolher' : 'Abrir'}</span></button>
    {open && <div className="p-3 sm:p-4 border-t border-emerald-200/60 dark:border-emerald-900 grid grid-cols-1 xl:grid-cols-4 gap-3">
      <div className="xl:col-span-4 flex flex-wrap gap-2"><label className="text-[9px] font-black">Intervalo<input value={range} onChange={(event) => setRange(event.target.value.toUpperCase())} className="ml-2 h-8 w-28 rounded-lg border bg-white dark:bg-slate-950 px-2 text-[10px]" /></label><label className="text-[9px] font-black">Coluna<input value={column} onChange={(event) => setColumn(event.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 3))} className="ml-2 h-8 w-16 rounded-lg border bg-white dark:bg-slate-950 px-2 text-[10px]" /></label><button onClick={() => replaceSheet(sortRange(activeSheet, range, column, 'asc', true), 'Intervalo ordenado em ordem crescente.')} className="h-8 px-2 rounded-lg border bg-white dark:bg-slate-900 text-[9px] font-black inline-flex items-center gap-1"><SortAscending className="w-3.5 h-3.5" /> Crescente</button><button onClick={() => replaceSheet(sortRange(activeSheet, range, column, 'desc', true), 'Intervalo ordenado em ordem decrescente.')} className="h-8 px-2 rounded-lg border bg-white dark:bg-slate-900 text-[9px] font-black inline-flex items-center gap-1"><SortDescending className="w-3.5 h-3.5" /> Decrescente</button><button onClick={() => { const result = trimRange(activeSheet, range); replaceSheet(result.sheet, `${result.changed} célula(s) tiveram espaços normalizados.`); }} className="h-8 px-2 rounded-lg border bg-white dark:bg-slate-900 text-[9px] font-black">Limpar espaços</button></div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Filter className="w-4 h-4 text-emerald-600" /> Filtro → nova aba</div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Texto a filtrar" className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" /><label className="mt-2 flex items-center gap-2 text-[9px]"><input type="checkbox" checked={exact} onChange={(event) => setExact(event.target.checked)} /> Correspondência exata</label><button onClick={filterToNewSheet} className="mt-2 w-full h-9 rounded-lg bg-emerald-600 text-white text-[9px] font-black">Criar aba filtrada</button></div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Replace className="w-4 h-4 text-blue-600" /> Localizar/substituir</div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Localizar" className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" /><input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="Substituir por" className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" /><button onClick={runReplace} disabled={!query} className="mt-2 w-full h-9 rounded-lg bg-blue-600 text-white text-[9px] font-black disabled:opacity-40">Substituir no intervalo</button></div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="text-[10px] font-black">Validação de dados</div><select value={validationKind} onChange={(event) => setValidationKind(event.target.value as any)} className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]"><option value="nonempty">Obrigatório</option><option value="number">Número / faixa</option><option value="date">Data válida</option><option value="list">Lista permitida</option></select>{validationKind === 'number' && <input value={validationArg} onChange={(event) => setValidationArg(event.target.value)} placeholder="mín:máx · ex. 0:100" className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" />}{validationKind === 'list' && <input value={validationArg} onChange={(event) => setValidationArg(event.target.value)} placeholder="Sim,Não,Pendente" className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" />}<button onClick={runValidation} className="mt-2 w-full h-9 rounded-lg bg-amber-500 text-white text-[9px] font-black">Auditar e destacar inválidos</button></div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="flex items-center gap-1.5 text-[10px] font-black"><Sparkles className="w-4 h-4 text-violet-600" /> Formatação condicional</div><select value={conditionKind} onChange={(event) => setConditionKind(event.target.value as any)} className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]"><option value="greater">Maior que</option><option value="less">Menor que</option><option value="equal">Igual a</option><option value="contains">Contém texto</option><option value="nonempty">Não vazio</option></select>{conditionKind !== 'nonempty' && <input value={conditionArg} onChange={(event) => setConditionArg(event.target.value)} className="mt-2 w-full h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" />}<button onClick={runConditional} className="mt-2 w-full h-9 rounded-lg bg-violet-600 text-white text-[9px] font-black">Aplicar condição</button></div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3"><div className="text-[10px] font-black">Fórmula rápida</div><div className="mt-2 grid grid-cols-2 gap-2"><select value={formulaOperation} onChange={(event) => setFormulaOperation(event.target.value as QuickFormula)} className="h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]"><option value="SUM">SOMA</option><option value="AVERAGE">MÉDIA</option><option value="MIN">MÍNIMO</option><option value="MAX">MÁXIMO</option><option value="COUNT">CONTAR</option></select><input value={formulaTarget} onChange={(event) => setFormulaTarget(event.target.value.toUpperCase())} placeholder="Destino · F2" className="h-9 rounded-lg border bg-slate-50 dark:bg-slate-950 px-2 text-[10px]" /></div><p className="mt-2 text-[8px] leading-relaxed text-slate-400">Usa o novo motor profissional: texto e vazios não distorcem MÉDIA/MÍNIMO/MÁXIMO. Fórmulas permanecem editáveis e são recalculadas ao salvar.</p><button onClick={runQuickFormula} className="mt-2 w-full h-9 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black">Inserir fórmula</button></div>
    </div>}
  </section>;
};