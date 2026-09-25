import React, { useEffect, useState } from 'react';
import { IconAlertTriangle, IconExternalLink, IconLoader2, IconRefresh, IconSettings } from '@tabler/icons-react';
import type { SavedProject } from '../types';
import { auth } from '../services/firebase';

type OnlyOfficeKind = 'word' | 'excel' | 'powerpoint';
interface Props { project: SavedProject; kind: OnlyOfficeKind; onProjectChange: (project: SavedProject) => void; showNotification?: (message: string, type?: 'success' | 'error') => void; }
declare global { interface Window { DocsAPI?: { DocEditor: new (elementId: string, config: Record<string, unknown>) => { destroyEditor?: () => void } } } }
const CONFIG_URL = String(import.meta.env.VITE_ONLYOFFICE_CONFIG_URL || '/api/onlyoffice/config');
const labels: Record<OnlyOfficeKind, string> = { word: 'Documento', excel: 'Planilha', powerpoint: 'Apresentação' };
const editorType = (kind: OnlyOfficeKind) => kind === 'word' ? 'word' : kind === 'excel' ? 'cell' : 'slide';

export const OnlyOfficeEditor: React.FC<Props> = ({ project, kind, showNotification }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let instance: { destroyEditor?: () => void } | null = null;
    setLoading(true);
    setError('');
    setConfigured(true);

    const load = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('Entre na sua conta para abrir este documento no ONLYOFFICE.');

        const response = await fetch(`${CONFIG_URL}?projectId=${encodeURIComponent(project.id)}&kind=${kind}`, {
          credentials: 'include',
          headers: { Accept: 'application/json', Authorization: `Bearer ${idToken}` },
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
          throw new Error(body?.message || (body?.error === 'ONLYOFFICE_NOT_CONFIGURED'
            ? 'O ONLYOFFICE ainda não está configurado no ambiente de produção.'
            : `Configuração ONLYOFFICE indisponível (HTTP ${response.status}).`));
        }

        const config = await response.json() as Record<string, unknown>;
        const serverUrl = String(config.documentServerUrl || '').replace(/\/$/, '');
        if (!serverUrl) throw new Error('O servidor ONLYOFFICE não foi informado pelo bridge.');

        if (!window.DocsAPI) {
          await new Promise<void>((resolve, reject) => {
            const scriptId = 'orbit-onlyoffice-api';
            const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
            if (existing) {
              existing.addEventListener('load', () => resolve(), { once: true });
              existing.addEventListener('error', () => reject(new Error('Não foi possível carregar a API do ONLYOFFICE Docs.')), { once: true });
              return;
            }
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = `${serverUrl}/web-apps/apps/api/documents/api.js`;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Não foi possível carregar a API do ONLYOFFICE Docs. Verifique se o servidor público do ONLYOFFICE está acessível.'));
            document.head.appendChild(script);
          });
        }

        if (cancelled || !window.DocsAPI?.DocEditor) return;
        instance = new window.DocsAPI.DocEditor('orbidoc-onlyoffice-editor', {
          ...config,
          documentType: editorType(kind),
          type: 'desktop',
          height: '100%',
          width: '100%',
          events: {
            onDocumentReady: () => setLoading(false),
            onError: (event: { data?: { errorDescription?: string } }) => {
              setError(event.data?.errorDescription || 'O ONLYOFFICE reportou um erro ao abrir o arquivo.');
              setLoading(false);
            },
            onRequestClose: () => showNotification?.('Editor encerrado.', 'success'),
          },
        });
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Falha ao iniciar o ONLYOFFICE.');
        setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; instance?.destroyEditor?.(); };
  }, [kind, project.id, showNotification]);

  if (!configured) return <section className="h-full min-h-[560px] flex items-center justify-center bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800"><div className="max-w-xl px-6 py-10 text-center"><IconSettings className="mx-auto h-8 w-8 text-violet-600" /><h2 className="mt-4 text-lg font-black">ONLYOFFICE ainda não foi conectado</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">O Orbit está preparado para usar o ONLYOFFICE como editor principal.</p><a href="https://api.onlyoffice.com/docs" target="_blank" rel="noreferrer" className="mt-5 inline-flex h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 items-center gap-2 text-xs font-bold"><IconExternalLink className="h-4 w-4" /> Documentação ONLYOFFICE</a></div></section>;

  return <section className="relative h-[calc(100dvh-7rem)] min-h-[560px] overflow-hidden bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800">
    {loading && !error ? <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 dark:bg-[#111318]/90 backdrop-blur-sm"><div className="flex items-center gap-2 text-xs font-bold"><IconLoader2 className="h-4 w-4 animate-spin text-violet-600" /> Abrindo {labels[kind]} no ONLYOFFICE…</div></div> : null}
    {error ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-white dark:bg-[#111318]"><div className="max-w-lg px-6 text-center"><IconAlertTriangle className="mx-auto h-8 w-8 text-amber-500" /><h2 className="mt-3 text-base font-black">Não foi possível abrir este arquivo</h2><p className="mt-2 text-xs text-slate-500">{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 h-9 px-3 rounded-lg bg-violet-600 text-white text-xs font-bold inline-flex items-center gap-2"><IconRefresh className="h-4 w-4" /> Tentar novamente</button></div></div> : null}
    <div id="orbidoc-onlyoffice-editor" className="h-full w-full" aria-label={`Editor ONLYOFFICE de ${labels[kind]}`} />
  </section>;
};
