import React, { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, Type, Sparkles, Check, SlidersHorizontal, X } from 'lucide-react';
import { AppThemeMode, AppFontFamily, AppFontSize } from '../types';

interface ThemeFontConfigProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeFontConfig: React.FC<ThemeFontConfigProps> = ({ isOpen, onClose }) => {
  const [themeMode, setThemeMode] = useState<AppThemeMode>(() => {
    return (localStorage.getItem('docswiss_theme_mode') as AppThemeMode) || 'auto';
  });

  const [fontFamily, setFontFamily] = useState<AppFontFamily>(() => {
    return (localStorage.getItem('docswiss_font_family') as AppFontFamily) || 'sans';
  });

  const [fontSize, setFontSize] = useState<AppFontSize>(() => {
    return (localStorage.getItem('docswiss_font_size') as AppFontSize) || 'normal';
  });

  // Handle Theme Mode changes
  useEffect(() => {
    localStorage.setItem('docswiss_theme_mode', themeMode);

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    if (themeMode === 'dark') {
      applyTheme(true);
    } else if (themeMode === 'light') {
      applyTheme(false);
    } else {
      // Auto: detect system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  // Handle Font Family changes
  useEffect(() => {
    localStorage.setItem('docswiss_font_family', fontFamily);

    const fontFamilies = {
      sans: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      serif: "'Playfair Display', Georgia, serif",
      mono: "'JetBrains Mono', monospace",
      dyslexic: "'OpenDyslexic', 'Lexend', sans-serif",
    };

    document.documentElement.style.setProperty('--app-font-family', fontFamilies[fontFamily]);
    document.body.style.fontFamily = fontFamilies[fontFamily];
  }, [fontFamily]);

  // Handle Font Size changes
  useEffect(() => {
    localStorage.setItem('docswiss_font_size', fontSize);

    const fontScales = {
      compact: '14px',
      normal: '16px',
      large: '18px',
    };

    document.documentElement.style.fontSize = fontScales[fontSize];
  }, [fontSize]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Aparência & Tipografia</h3>
              <p className="text-xs text-slate-500">Personalize o tema e as fontes do app</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Theme Mode Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Modo de Tema</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'auto', label: 'Automático', icon: Monitor, desc: 'Acompanha o Sistema' },
              { id: 'light', label: 'Claro', icon: Sun, desc: 'Swiss Light' },
              { id: 'dark', label: 'Escuro', icon: Moon, desc: 'Swiss Dark' },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = themeMode === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setThemeMode(t.id as any)}
                  className={`p-3 rounded-2xl border text-left flex flex-col items-center justify-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-md scale-102'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Family Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Tipografia do Sistema</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'sans', label: 'Sans (Suíça Clean)', font: 'sans-serif' },
              { id: 'serif', label: 'Serif (Editorial Elegante)', font: 'serif' },
              { id: 'mono', label: 'Mono (Código & Dados)', font: 'monospace' },
              { id: 'dyslexic', label: 'Acessível (Foco Leve)', font: 'sans-serif' },
            ].map((f) => {
              const isActive = fontFamily === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFontFamily(f.id as any)}
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-400 dark:border-indigo-800 font-bold'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className="text-xs truncate">{f.label}</span>
                  {isActive && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Size Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Escala de Texto</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'compact', label: 'Pequena (14px)' },
              { id: 'normal', label: 'Padrão (16px)' },
              { id: 'large', label: 'Confortável (18px)' },
            ].map((s) => {
              const isActive = fontSize === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setFontSize(s.id as any)}
                  className={`py-2 px-3 rounded-xl border text-center text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Apply & Close */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Salvar Preferências
          </button>
        </div>
      </div>
    </div>
  );
};
