import React, { useEffect, useState } from 'react';
import {
  Sun, Moon, Monitor, Type, Sparkles, Check, SlidersHorizontal, X,
  Save, Cloud, Shield, Clock, Palette, CornerDownRight, RefreshCw, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppThemeMode, AppFontFamily, AppFontSize } from '../types';
import { saveUserSettingsToFirestore, loadUserSettingsFromFirestore } from '../services/firebase';

export type AppThemePreset = 'swiss' | 'nordic' | 'sunset' | 'midnight' | 'sepia' | 'cyber' | 'emerald' | 'oceanic';
export type AppCornerRadius = 'sharp' | 'rounded' | 'pill';

export interface ThemeFontConfigProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  autoSaveDelayMs: number;
  setAutoSaveDelayMs: (delay: number) => void;
  lastSavedAt?: Date | null;
  autoSaveStatus: 'idle' | 'pending' | 'saving' | 'saved' | 'error';
  onForceSave?: () => void;
}

const ACCENT_COLORS = [
  { id: 'indigo', hex: '#6366f1', label: 'Índigo Royale', class: 'bg-indigo-500' },
  { id: 'emerald', hex: '#10b981', label: 'Esmeralda Suíça', class: 'bg-emerald-500' },
  { id: 'violet', hex: '#8b5cf6', label: 'Púrpura Deep', class: 'bg-purple-500' },
  { id: 'rose', hex: '#f43f5e', label: 'Rosa Rubro', class: 'bg-rose-500' },
  { id: 'amber', hex: '#f59e0b', label: 'Âmbar Dourado', class: 'bg-amber-500' },
  { id: 'teal', hex: '#14b8a6', label: 'Oceanic Teal', class: 'bg-teal-500' },
  { id: 'cyan', hex: '#06b6d4', label: 'Ciano Neon', class: 'bg-cyan-500' },
];

const THEME_PRESETS: { id: AppThemePreset; name: string; emoji: string; desc: string; bgClass: string; accentHex: string }[] = [
  { id: 'swiss', name: 'DocPlus+ Classic', emoji: '🇨🇭', desc: 'Minimalismo Suíço de alta precisão', bgClass: 'from-slate-900 to-indigo-950', accentHex: '#6366f1' },
  { id: 'emerald', name: 'Emerald Forest', emoji: '🌲', desc: 'Verde calmo para alta produtividade', bgClass: 'from-slate-900 to-emerald-950', accentHex: '#10b981' },
  { id: 'sunset', name: 'Sunset Dusk', emoji: '🌅', desc: 'Degradê quente de pôr do sol', bgClass: 'from-rose-950 to-amber-950', accentHex: '#f43f5e' },
  { id: 'nordic', name: 'Nordic Ice', emoji: '❄️', desc: 'Frequência azul gélida e focada', bgClass: 'from-slate-950 to-cyan-950', accentHex: '#06b6d4' },
  { id: 'midnight', name: 'Midnight Sapphire', emoji: '🌌', desc: 'Escuro luxuoso sem fadiga visual', bgClass: 'from-slate-950 to-slate-900', accentHex: '#8b5cf6' },
  { id: 'sepia', name: 'Sepia Vintage Paper', emoji: '📜', desc: 'Tom creme descansativo estilo livro', bgClass: 'from-amber-950 to-stone-900', accentHex: '#d97706' },
  { id: 'cyber', name: 'Cyber Matrix', emoji: '⚡', desc: 'Preto puro com acentos verde fluorescente', bgClass: 'from-zinc-950 to-black', accentHex: '#22c55e' },
  { id: 'oceanic', name: 'Oceanic Abyss', emoji: '🌊', desc: 'Tons marinhos profundos e calmos', bgClass: 'from-slate-950 to-teal-950', accentHex: '#14b8a6' },
];

export const ThemeFontConfig: React.FC<ThemeFontConfigProps> = ({
  isOpen,
  onClose,
  userEmail,
  autoSaveEnabled,
  setAutoSaveEnabled,
  autoSaveDelayMs,
  setAutoSaveDelayMs,
  lastSavedAt,
  autoSaveStatus,
  onForceSave
}) => {
  const [themeMode, setThemeMode] = useState<AppThemeMode>(() => {
    return (localStorage.getItem('docplus_theme_mode') as AppThemeMode) || (localStorage.getItem('docswiss_theme_mode') as AppThemeMode) || 'auto';
  });

  const [themePreset, setThemePreset] = useState<AppThemePreset>(() => {
    return (localStorage.getItem('docplus_theme_preset') as AppThemePreset) || 'swiss';
  });

  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('docplus_accent_color') || '#6366f1';
  });

  const [fontFamily, setFontFamily] = useState<AppFontFamily>(() => {
    return (localStorage.getItem('docplus_font_family') as AppFontFamily) || (localStorage.getItem('docswiss_font_family') as AppFontFamily) || 'sans';
  });

  const [fontSize, setFontSize] = useState<AppFontSize>(() => {
    return (localStorage.getItem('docplus_font_size') as AppFontSize) || (localStorage.getItem('docswiss_font_size') as AppFontSize) || 'normal';
  });

  const [cornerRadius, setCornerRadius] = useState<AppCornerRadius>(() => {
    return (localStorage.getItem('docplus_corner_radius') as AppCornerRadius) || 'rounded';
  });

  const [activeTab, setActiveTab] = useState<'theme' | 'autosave' | 'cloud'>('theme');
  const [cloudSyncing, setCloudSyncing] = useState(false);

  // Apply Theme Mode (Dark / Light / Auto)
  useEffect(() => {
    localStorage.setItem('docplus_theme_mode', themeMode);
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
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  // Apply Theme Preset & Accent Color
  useEffect(() => {
    localStorage.setItem('docplus_theme_preset', themePreset);
    localStorage.setItem('docplus_accent_color', accentColor);
    document.documentElement.setAttribute('data-theme-preset', themePreset);
    document.documentElement.style.setProperty('--accent-color', accentColor);
  }, [themePreset, accentColor]);

  // Apply Font Family
  useEffect(() => {
    localStorage.setItem('docplus_font_family', fontFamily);
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

  // Apply Font Size
  useEffect(() => {
    localStorage.setItem('docplus_font_size', fontSize);
    localStorage.setItem('docswiss_font_size', fontSize);

    const fontScales = {
      compact: '14px',
      normal: '16px',
      large: '18px',
    };

    document.documentElement.style.fontSize = fontScales[fontSize];
  }, [fontSize]);

  // Apply Corner Radius
  useEffect(() => {
    localStorage.setItem('docplus_corner_radius', cornerRadius);
    document.documentElement.setAttribute('data-radius', cornerRadius);
  }, [cornerRadius]);

  // Save Settings to Firestore Cloud
  const handleSaveToCloud = async () => {
    setCloudSyncing(true);
    try {
      await saveUserSettingsToFirestore({
        userEmail: userEmail || 'invitado@docplus.com',
        themeMode,
        themePreset,
        accentColor,
        fontFamily,
        fontSize,
        autoSaveEnabled,
        autoSaveDelayMs,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Sync error:', e);
    } finally {
      setTimeout(() => setCloudSyncing(false), 600);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Top Header */}
          <div className="p-6 pb-4 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Tema, Auto-Salvamento & Firebase
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Firestore Sync
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Personalize a experiência e regras do DocPlus+</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/40 p-1.5 gap-1">
            <button
              onClick={() => setActiveTab('theme')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'theme'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Palette className="w-4 h-4" />
              Temas & Aparência
            </button>
            <button
              onClick={() => setActiveTab('autosave')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'autosave'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              Auto-Salvamento
            </button>
            <button
              onClick={() => setActiveTab('cloud')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'cloud'
                  ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Cloud className="w-4 h-4" />
              Nuvem Firestore
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {activeTab === 'theme' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {/* Dark / Light Mode */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5" /> Modo de Visualização
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'auto', label: 'Automático', icon: Monitor, desc: 'Do Sistema' },
                      { id: 'light', label: 'Claro Clean', icon: Sun, desc: 'Visual Diurno' },
                      { id: 'dark', label: 'Escuro Pro', icon: Moon, desc: 'Visual Noturno' },
                    ].map((t) => {
                      const Icon = t.icon;
                      const isActive = themeMode === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setThemeMode(t.id as any)}
                          className={`p-3 rounded-2xl border text-left flex flex-col items-center justify-center gap-1.5 transition-all ${
                            isActive
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-102'
                              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs font-bold">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Theme Presets */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Predefinições de Cores
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {THEME_PRESETS.map((preset) => {
                      const isActive = themePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setThemePreset(preset.id);
                            setAccentColor(preset.accentHex);
                          }}
                          className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all relative overflow-hidden ${
                            isActive
                              ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 shadow-sm ring-2 ring-indigo-500/30'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base">{preset.emoji}</span>
                            <div className="w-3.5 h-3.5 rounded-full border border-white/40" style={{ backgroundColor: preset.accentHex }} />
                          </div>
                          <span className="text-xs font-bold truncate mt-1">{preset.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{preset.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Accent Color Picker */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Cor de Acento Personalizada</label>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_COLORS.map((c) => {
                      const isActive = accentColor === c.hex;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setAccentColor(c.hex)}
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${c.class} ${
                            isActive ? 'ring-4 ring-offset-2 ring-indigo-500 scale-110 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'
                          }`}
                          title={c.label}
                        >
                          {isActive && <Check className="w-5 h-5 text-white drop-shadow-md" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Typography & Font Scaling */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5" /> Fonte do Sistema
                    </label>
                    <div className="space-y-1.5">
                      {[
                        { id: 'sans', label: 'Plus Jakarta Sans (Moderna)' },
                        { id: 'serif', label: 'Playfair Display (Editorial)' },
                        { id: 'mono', label: 'JetBrains Mono (Código)' },
                        { id: 'dyslexic', label: 'OpenDyslexic (Acessível)' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFontFamily(f.id as any)}
                          className={`w-full p-2.5 rounded-xl border text-left text-xs flex items-center justify-between transition-all ${
                            fontFamily === f.id
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-400 font-bold'
                              : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span>{f.label}</span>
                          {fontFamily === f.id && <Check className="w-4 h-4 text-indigo-500" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Escala do Texto</label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {[
                        { id: 'compact', label: 'Compacta (14px)', desc: 'Mais densidade de dados' },
                        { id: 'normal', label: 'Padrão (16px)', desc: 'Equilíbrio ideal' },
                        { id: 'large', label: 'Confortável (18px)', desc: 'Leitura descansada' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setFontSize(s.id as any)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            fontSize === s.id
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-400 font-bold'
                              : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-bold">{s.label}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{s.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'autosave' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {/* Auto Save Main Toggle */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${autoSaveEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Auto-Salvamento Automático</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Salva rascunhos continuamente sem precisar clicar em nada</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${autoSaveEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                  >
                    <span className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${autoSaveEnabled ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Auto Save Interval Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Intervalo de Salvamento</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { delay: 3000, label: '3 Segundos', desc: 'Ultrarrápido' },
                      { delay: 5000, label: '5 Segundos', desc: 'Recomendado' },
                      { delay: 10000, label: '10 Segundos', desc: 'Equilibrado' },
                      { delay: 30000, label: '30 Segundos', desc: 'Econômico' },
                    ].map((item) => (
                      <button
                        key={item.delay}
                        onClick={() => setAutoSaveDelayMs(item.delay)}
                        className={`p-3 rounded-2xl border text-center transition-all ${
                          autoSaveDelayMs === item.delay
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-bold">{item.label}</div>
                        <div className={`text-[10px] ${autoSaveDelayMs === item.delay ? 'text-white/80' : 'text-slate-400'}`}>{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status & Immediate Manual Trigger */}
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Save className="w-4 h-4 text-indigo-500" />
                      Status Atual do Auto-Save:
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-white font-bold text-[10px]">
                      {autoSaveStatus === 'saving' ? 'Salvando...' : autoSaveStatus === 'saved' ? 'Sincronizado' : 'Pronto'}
                    </span>
                  </div>

                  {lastSavedAt && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Último salvamento registrado em: <strong className="text-slate-700 dark:text-slate-200">{lastSavedAt.toLocaleTimeString('pt-BR')}</strong>
                    </div>
                  )}

                  {onForceSave && (
                    <button
                      onClick={onForceSave}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Forçar Salvamento Imediato Agora
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'cloud' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900/10 to-purple-900/10 border border-indigo-200/50 dark:border-indigo-800/50 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    Firebase Firestore Configurado e Ativo
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Sua conta está integrada ao banco de dados em tempo real do Google Firebase. Todos os documentos auto-salvos são mantidos na nuvem de forma segura.
                  </p>
                  <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl text-[11px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                    Database ID: <span className="text-indigo-600 dark:text-indigo-400 font-bold">ai-studio-docswiss-116c7e86-02a0-4cef-95a3-4f36aa66518a</span>
                  </div>
                </div>

                <button
                  onClick={handleSaveToCloud}
                  disabled={cloudSyncing}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-bold rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${cloudSyncing ? 'animate-spin' : ''}`} />
                  {cloudSyncing ? 'Sincronizando com Firestore...' : 'Sincronizar Minhas Configurações na Nuvem'}
                </button>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">DocPlus+ Studio Engine</span>
            <button
              onClick={() => {
                handleSaveToCloud();
                onClose();
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Concluir & Aplicar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
