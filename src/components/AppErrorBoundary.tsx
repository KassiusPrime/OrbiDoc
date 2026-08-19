import React from 'react';
import { IconAlertTriangle as AlertTriangle, IconRefresh as Refresh, IconHome as Home } from '@tabler/icons-react';

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('OrbiDoc workspace crashed:', error, info);
  }

  private reload = () => window.location.reload();

  private recoverHome = () => {
    try {
      sessionStorage.removeItem('orbidoc_last_view');
    } catch {
      // Storage may be unavailable in hardened browser contexts.
    }
    window.location.assign('/');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-center p-5">
        <div className="w-full max-w-xl rounded-3xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 shadow-xl p-6 sm:p-8">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 flex items-center justify-center"><AlertTriangle className="w-6 h-6" /></div>
          <h1 className="mt-4 text-xl font-black">O OrbiDoc encontrou uma falha nesta tela</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Seus arquivos locais não foram apagados. Você pode recarregar o aplicativo ou voltar ao início sem limpar a biblioteca.</p>
          <div className="mt-5 rounded-2xl bg-slate-100 dark:bg-slate-950 p-3 font-mono text-[11px] text-rose-700 dark:text-rose-300 break-words">{this.state.error.message || 'Erro desconhecido'}</div>
          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <button onClick={this.reload} className="h-11 px-4 rounded-xl bg-indigo-600 text-white text-xs font-black inline-flex items-center justify-center gap-2"><Refresh className="w-4 h-4" /> Recarregar</button>
            <button onClick={this.recoverHome} className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black inline-flex items-center justify-center gap-2"><Home className="w-4 h-4" /> Voltar ao início</button>
          </div>
        </div>
      </div>
    );
  }
}
