import React, { useEffect, useState } from 'react';
import {
  IconAdjustments as Appearance,
  IconBrandGithub as GitHub,
  IconBrandGoogle as Google,
  IconBrandWindows as Microsoft,
  IconCheck as Check,
  IconCloud as Cloud,
  IconDeviceLaptop as Device,
  IconKey as Key,
  IconLock as Lock,
  IconLogout as LogOut,
  IconPalette as Palette,
  IconPlugConnected as Plug,
  IconSettings as Settings,
  IconShieldCheck as Shield,
  IconUser as User,
} from '@tabler/icons-react';
import type { GoogleUserProfile, MicrosoftUserProfile } from '../types';
import { isGoogleOAuthConfigured, loginWithGooglePopup, logoutGoogleUser } from '../services/googleAuthDrive';
import { isMicrosoftOAuthConfigured, loginWithMicrosoftPopup, logoutMicrosoftUser } from '../services/microsoftAuthOffice';
import { OrbiDocAuthPanel } from './OrbiDocAuthPanel';

type ThemePreference = 'system' | 'light' | 'dark';
type SectionId = 'appearance' | 'account' | 'connections' | 'storage' | 'ai';

type Props = {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  googleUser: GoogleUserProfile | null;
  onGoogleUserChange: (user: GoogleUserProfile | null) => void;
  microsoftUser: MicrosoftUserProfile | null;
  onMicrosoftUserChange: (user: MicrosoftUserProfile | null) => void;
  onOpenInstall?: () => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
};

const SECTIONS: Array<{ id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'appearance', label: 'Aparência', icon: Appearance },
  { id: 'account', label: 'Conta', icon: User },
  { id: 'connections', label: 'Conexões', icon: Plug },
  { id: 'storage', label: 'Armazenamento e privacidade', icon: Shield },
  { id: 'ai', label: 'IA e avançado', icon: Key },
];

const ThemeCard: React.FC<{ value: ThemePreference; current: ThemePreference; label: string; detail: string; onSelect: () => void }> = ({ value, current, label, detail, onSelect }) => (
  <button type="button" onClick={onSelect} aria-pressed={value === current} className={`min-h-24 rounded-2xl border p-4 text-left transition-colors ${value === current ? 'border-[#3157F6] bg-[#E8EEFF]/65 dark:bg-[#0D1E5B]/55' : 'border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] hover:border-[#3157F6]/35'}`}>
    <div className="flex items-center gap-2"><span className="text-xs font-black">{label}</span>{value === current && <span className="ml-auto w-5 h-5 rounded-full bg-[#3157F6] text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}</div>
    <p className="mt-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{detail}</p>
  </button>
);

const ConnectionRow: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; connected: boolean; configured?: boolean; busy?: boolean; onConnect?: () => void; onDisconnect?: () => void; footnote?: string }> = ({ icon, title, subtitle, connected, configured = true, busy, onConnect, onDisconnect, footnote }) => (
  <div className="rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] p-4">
    <div className="flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl bg-[#EEF2F8] dark:bg-slate-800 flex items-center justify-center shrink-0">{icon}</span>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-xs font-black">{title}<span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : configured ? 'bg-slate-300' : 'bg-amber-500'}`} /></div><div className="mt-0.5 text-[9px] text-slate-400 truncate">{subtitle}</div></div>
      {connected ? <button onClick={onDisconnect} className="h-9 px-3 rounded-xl border border-rose-200 dark:border-rose-900 text-[9px] font-black text-rose-600 inline-flex items-center gap-1.5"><LogOut className="w-3.5 h-3.5" /> Desconectar</button> : <button onClick={onConnect} disabled={!configured || busy || !onConnect} className="h-9 px-3 rounded-xl bg-[#3157F6] text-white text-[9px] font-black disabled:opacity-40">{busy ? 'Abrindo…' : configured ? 'Conectar' : 'Configuração necessária'}</button>}
    </div>
    {footnote && <p className="mt-3 pl-[52px] text-[9px] leading-relaxed text-slate-400">{footnote}</p>}
  </div>
);

export const SettingsWorkspace: React.FC<Props> = ({
  theme,
  onThemeChange,
  googleUser,
  onGoogleUserChange,
  microsoftUser,
  onMicrosoftUserChange,
  onOpenInstall = () => {},
  showNotification = () => {},
}) => {
  const [section, setSection] = useState<SectionId>('appearance');
  const [busy, setBusy] = useState<'google' | 'microsoft' | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: SectionId }>).detail;
      if (detail?.section && SECTIONS.some((item) => item.id === detail.section)) setSection(detail.section);
    };
    window.addEventListener('orbidoc:settings-section', handler as EventListener);
    return () => window.removeEventListener('orbidoc:settings-section', handler as EventListener);
  }, []);

  const connectGoogle = async () => {
    setBusy('google');
    try {
      const user = await loginWithGooglePopup();
      onGoogleUserChange(user);
      showNotification(`Google Drive conectado: ${user.email}`, 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha ao conectar Google Drive.', 'error'); }
    finally { setBusy(null); }
  };

  const connectMicrosoft = async () => {
    setBusy('microsoft');
    try {
      const user = await loginWithMicrosoftPopup();
      onMicrosoftUserChange(user);
      showNotification(`OneDrive conectado: ${user.email}`, 'success');
    } catch (error: any) { showNotification(error?.message || 'Falha ao conectar OneDrive.', 'error'); }
    finally { setBusy(null); }
  };

  const renderSection = () => {
    if (section === 'appearance') return <div>
      <SectionHeader icon={Palette} title="Aparência" detail="Tema, contraste e comportamento visual ficam centralizados aqui. O cabeçalho do workspace não alterna mais o tema." />
      <div className="mt-5 grid sm:grid-cols-3 gap-3">
        <ThemeCard value="system" current={theme} label="Sistema" detail="Segue automaticamente a aparência clara/escura do dispositivo." onSelect={() => onThemeChange('system')} />
        <ThemeCard value="light" current={theme} label="Claro" detail="Superfícies claras e neutras com Orbital Azure como destaque." onSelect={() => onThemeChange('light')} />
        <ThemeCard value="dark" current={theme} label="Escuro" detail="Deep Space com superfícies discretas e contraste reforçado." onSelect={() => onThemeChange('dark')} />
      </div>
      <div className="mt-5 rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-[#F8FAFD] dark:bg-[#0B111D] p-4 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400"><strong className="text-slate-700 dark:text-slate-200">Direção visual:</strong> interface de host de serviços, não um painel de ferramentas. O conteúdo e o arquivo atual devem dominar a tela; comandos avançados aparecem somente no contexto correto.</div>
    </div>;

    if (section === 'account') return <div>
      <SectionHeader icon={User} title="Conta OrbiDoc" detail="Login, segurança e sincronização do workspace. A conta OrbiDoc continua separada das permissões de Drive, OneDrive e GitHub." />
      <div className="mt-5 max-w-2xl"><OrbiDocAuthPanel onNotification={showNotification} /></div>
    </div>;

    if (section === 'connections') return <div>
      <SectionHeader icon={Plug} title="Conexões" detail="Autorize cada serviço explicitamente. Conectar uma conta ao OrbiDoc não concede acesso automático a todas as outras nuvens." />
      <div className="mt-5 space-y-3 max-w-3xl">
        <ConnectionRow icon={<Google className="w-4.5 h-4.5" />} title="Google Drive" subtitle={googleUser?.email || 'Arquivos do Google Drive'} connected={Boolean(googleUser)} configured={isGoogleOAuthConfigured()} busy={busy === 'google'} onConnect={() => void connectGoogle()} onDisconnect={() => { logoutGoogleUser(); onGoogleUserChange(null); showNotification('Google Drive desconectado.', 'success'); }} footnote="O navegador atual usa autorização separada do login OrbiDoc. Arquivos Google nativos são exportados para DOCX/XLSX/PPTX/PDF ao serem abertos internamente." />
        <ConnectionRow icon={<Microsoft className="w-4.5 h-4.5" />} title="Microsoft / OneDrive" subtitle={microsoftUser?.email || 'OneDrive via Microsoft Graph'} connected={Boolean(microsoftUser)} configured={isMicrosoftOAuthConfigured()} busy={busy === 'microsoft'} onConnect={() => void connectMicrosoft()} onDisconnect={() => { logoutMicrosoftUser(); onMicrosoftUserChange(null); showNotification('OneDrive desconectado.', 'success'); }} footnote="Downloads no navegador usam a URL temporária pré-autenticada fornecida pelo Microsoft Graph, em vez de seguir /content com Authorization através de redirecionamento CORS." />
        <ConnectionRow icon={<GitHub className="w-4.5 h-4.5" />} title="GitHub" subtitle="Repositórios públicos disponíveis no navegador de serviços" connected={false} configured={false} footnote="Leitura de repositórios públicos já funciona sem token. Repositórios privados e escrita serão ligados por GitHub App com permissões granulares; o OrbiDoc não vai pedir para você gravar um PAT pessoal no navegador." />
        <div className="rounded-2xl border border-dashed border-[#DCE3EE] dark:border-slate-800 p-4 text-[9px] leading-relaxed text-slate-400"><strong>Próximos conectores:</strong> SharePoint/Teams via Microsoft Graph e outros provedores compatíveis com API serão adicionados como fontes dentro do mesmo navegador, sem criar um novo “mini-app” para cada nuvem.</div>
      </div>
    </div>;

    if (section === 'storage') return <div>
      <SectionHeader icon={Shield} title="Armazenamento e privacidade" detail="O OrbiDoc continua local-first. Serviços externos só recebem arquivos quando uma ação explícita de upload/sincronização é executada." />
      <div className="mt-5 grid md:grid-cols-2 gap-3 max-w-4xl">
        <InfoCard icon={<Device className="w-5 h-5" />} title="Arquivos locais" body="Projetos do workspace permanecem disponíveis localmente e continuam utilizáveis offline quando o formato/engine não depende de rede." />
        <InfoCard icon={<Cloud className="w-5 h-5" />} title="Fontes externas" body="Drive, OneDrive e futuros serviços aparecem como origens de arquivo. Abrir um item não copia automaticamente outros arquivos da conta." />
        <InfoCard icon={<Lock className="w-5 h-5" />} title="Credenciais" body="Tokens de serviços não devem virar preferências de tema nem ficar misturados ao conteúdo dos documentos. A arquitetura caminha para autorização backend quando refresh/offline exigir segredo." />
        <button onClick={onOpenInstall} className="rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] p-4 text-left hover:border-[#3157F6]/35"><div className="flex items-center gap-2 text-xs font-black"><Device className="w-5 h-5 text-[#3157F6]" /> Instalação e Android</div><p className="mt-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Abrir opções de instalação PWA/Android e orientações do dispositivo.</p></button>
      </div>
    </div>;

    return <div>
      <SectionHeader icon={Key} title="IA e avançado" detail="Configurações que não precisam ocupar o cabeçalho ficam aqui. No Android, chaves BYOK continuam protegidas pelo Keystore quando esse recurso estiver habilitado para a conta." />
      <div className="mt-5 grid md:grid-cols-2 gap-3 max-w-4xl">
        <button onClick={() => window.dispatchEvent(new Event('orbidoc:open-ai-settings'))} className="rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] p-4 text-left hover:border-[#3157F6]/35"><div className="flex items-center gap-2 text-xs font-black"><Key className="w-5 h-5 text-[#3157F6]" /> Configuração de IA</div><p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">Abrir configuração nativa disponível neste dispositivo.</p></button>
        <InfoCard icon={<Settings className="w-5 h-5" />} title="Diagnóstico" body="Status de providers, auditorias e ferramentas de manutenção permanecem acessíveis, mas deixam de competir visualmente com o arquivo atual." />
      </div>
    </div>;
  };

  return <div className="max-w-6xl mx-auto min-h-full grid md:grid-cols-[230px_minmax(0,1fr)] gap-4 md:gap-6">
    <aside className="md:sticky md:top-0 self-start rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] p-2 overflow-x-auto md:overflow-visible">
      <div className="hidden md:block px-3 pt-3 pb-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">OrbiDoc</div><div className="mt-1 text-base font-black">Configurações</div></div>
      <nav className="flex md:block gap-1 min-w-max md:min-w-0" aria-label="Seções de configurações">{SECTIONS.map((item) => { const Icon = item.icon; const active = section === item.id; return <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-current={active ? 'page' : undefined} className={`min-h-10 px-3 rounded-xl flex items-center gap-2 text-[10px] font-black whitespace-nowrap md:w-full ${active ? 'bg-[#E8EEFF] dark:bg-[#0D1E5B]/55 text-[#2446D8] dark:text-[#AFC4FF]' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon className="w-4 h-4" />{item.label}</button>; })}</nav>
    </aside>
    <section className="min-w-0 rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] p-4 sm:p-6 lg:p-7">{renderSection()}</section>
  </div>;
};

const SectionHeader: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; detail: string }> = ({ icon: Icon, title, detail }) => <div className="max-w-3xl"><span className="w-10 h-10 rounded-xl bg-[#E8EEFF] dark:bg-[#0D1E5B]/55 text-[#3157F6] dark:text-[#7AA2FF] flex items-center justify-center"><Icon className="w-5 h-5" /></span><h1 className="mt-4 text-xl sm:text-2xl font-black tracking-[-0.025em]">{title}</h1><p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400">{detail}</p></div>;

const InfoCard: React.FC<{ icon: React.ReactNode; title: string; body: string }> = ({ icon, title, body }) => <div className="rounded-2xl border border-[#DCE3EE] dark:border-slate-800 bg-white dark:bg-[#101827] p-4"><div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100"><span className="text-[#3157F6] dark:text-[#7AA2FF]">{icon}</span>{title}</div><p className="mt-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{body}</p></div>;
