import fs from 'node:fs';

function replaceInFile(file, replacements) {
  let content = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) {
    if (!content.includes(from)) {
      console.warn(`Trecho não encontrado em ${file}: ${from.slice(0, 90)}`);
      continue;
    }
    content = content.split(from).join(to);
  }
  fs.writeFileSync(file, content);
}

replaceInFile('README.md', [
  ['# docutools-pro', '# OrbiDoc'],
]);

replaceInFile('DOCUMENTATION.md', [
  ['docutools-pro/', 'orbidoc/'],
]);

replaceInFile('scripts/check-orbidoc-brand.mjs', [
  ["  const ext = path.extname(file).toLowerCase();\n  if (!textExtensions.has(ext) && path.basename(file) !== 'bun.lock') continue;", "  if (rel === 'scripts/check-orbidoc-brand.mjs') continue;\n  const ext = path.extname(file).toLowerCase();\n  if (!textExtensions.has(ext) && path.basename(file) !== 'bun.lock') continue;"],
]);

replaceInFile('src/components/ThemeFontConfig.tsx', [
  ["return (localStorage.getItem('orbidoc_theme_mode') as AppThemeMode) || (localStorage.getItem('orbidoc_theme_mode') as AppThemeMode) || 'auto';", "return (localStorage.getItem('orbidoc_theme_mode') as AppThemeMode) || 'auto';"],
  ["return (localStorage.getItem('orbidoc_font_family') as AppFontFamily) || (localStorage.getItem('orbidoc_font_family') as AppFontFamily) || 'sans';", "return (localStorage.getItem('orbidoc_font_family') as AppFontFamily) || 'sans';"],
  ["return (localStorage.getItem('orbidoc_font_size') as AppFontSize) || (localStorage.getItem('orbidoc_font_size') as AppFontSize) || 'normal';", "return (localStorage.getItem('orbidoc_font_size') as AppFontSize) || 'normal';"],
  ["    localStorage.setItem('orbidoc_theme_mode', themeMode);\n    localStorage.setItem('orbidoc_theme_mode', themeMode);", "    localStorage.setItem('orbidoc_theme_mode', themeMode);"],
  ["    localStorage.setItem('orbidoc_font_family', fontFamily);\n    localStorage.setItem('orbidoc_font_family', fontFamily);", "    localStorage.setItem('orbidoc_font_family', fontFamily);"],
  ["    localStorage.setItem('orbidoc_font_size', fontSize);\n    localStorage.setItem('orbidoc_font_size', fontSize);", "    localStorage.setItem('orbidoc_font_size', fontSize);"],
  ["                  <div className=\"p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl text-[11px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800\">\n                    Database ID: <span className=\"text-indigo-600 dark:text-indigo-400 font-bold\">ai-studio-orbidoc-116c7e86-02a0-4cef-95a3-4f36aa66518a</span>\n                  </div>", "                  <div className=\"p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800\">\n                    Banco Firestore existente preservado para manter compatibilidade com os dados já criados.\n                  </div>"],
]);

replaceInFile('src/components/AiWorkspace.tsx', [
  ["const FALLBACK_CATALOG: AiModelOption[] = [\n  { id: 'gemini-3.6-flash', provider: 'gemini', label: 'Gemini 3.6 Flash', enabled: true, recommended: true },\n];", "const FALLBACK_CATALOG: AiModelOption[] = [];"],
  ["const [localModelKey, setLocalModelKey] = useState(() => selectedModelKey || localStorage.getItem(MODEL_KEY) || 'gemini:gemini-3.6-flash');", "const [localModelKey, setLocalModelKey] = useState(() => selectedModelKey || localStorage.getItem(MODEL_KEY) || '');"],
  ["        const enabled = (data.models as AiModelOption[]).filter((model) => model.enabled);\n        if (!enabled.length) return;\n        setCatalog(enabled);", "        const enabled = (data.models as AiModelOption[]).filter((model) => model.enabled);\n        if (!enabled.length) {\n          setCatalog([]);\n          setArenaModels([]);\n          setLocalModelKey('');\n          localStorage.removeItem(MODEL_KEY);\n          return;\n        }\n        setCatalog(enabled);"],
  ["      .catch(() => setCatalog(FALLBACK_CATALOG));", "      .catch(() => {\n        setCatalog([]);\n        setArenaModels([]);\n        setLocalModelKey('');\n      });"],
  ["      {runtime?.fallbackUsed && (\n        <div className=\"px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2\"><AlertTriangle className=\"w-4 h-4 shrink-0\" /><span>Fallback ativo: {runtime.requestedProvider}/{runtime.requestedModel || 'auto'} → <strong>{runtime.provider}/{runtime.routedModel || runtime.model}</strong>. {runtime.fallbackReason}</span></div>\n      )}", "      {runtime?.fallbackUsed && (\n        <div className=\"px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2\"><AlertTriangle className=\"w-4 h-4 shrink-0\" /><span>Fallback ativo: {runtime.requestedProvider}/{runtime.requestedModel || 'auto'} → <strong>{runtime.provider}/{runtime.routedModel || runtime.model}</strong>. {runtime.fallbackReason}</span></div>\n      )}\n\n      {!catalog.length && (\n        <div className=\"px-4 py-3 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-800 dark:text-rose-200 flex items-start gap-2\">\n          <AlertTriangle className=\"w-4 h-4 shrink-0 mt-0.5\" />\n          <span><strong>Nenhum provedor de IA está ativo.</strong> Configure pelo menos uma credencial segura no servidor (Gemini, Groq ou OpenRouter). O OrbiDoc não simula um modelo disponível quando o backend não possui uma chave válida.</span>\n        </div>\n      )}"],
]);

fs.rmSync('scripts/finalize-orbidoc.mjs', { force: true });
console.log('Final OrbiDoc cleanup applied.');
