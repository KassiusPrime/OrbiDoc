import React, { useEffect, useMemo, useState } from 'react';
import { IconAlertTriangle, IconExternalLink, IconLoader2, IconRefresh, IconSettings } from '@tabler/icons-react';
import type { SavedProject } from '../types';
import { auth } from '../services/firebase';

type OnlyOfficeKind = 'word' | 'excel' | 'powerpoint';
interface Props { project: SavedProject; kind: OnlyOfficeKind; onProjectChange: (project: SavedProject) => void; showNotification?: (message: string, type?: 'success' | 'error') => void; }
declare global { interface Window { DocsAPI?: { DocEditor: new (elementId: string, config: Record<string, unknown>) => { destroyEditor?: () => void } } } }
const SERVER_URL = String(import.meta.env.VITE_ONLYOFFICE_DOCUMENT_SERVER_URL || '').replace(/\/$/, '');
const CONFIG_URL = String(import.meta.env.VITE_ONLYOFFICE_CONFIG_URL || '/api/onlyoffice/config');
const labels: Record<OnlyOfficeKind, string> = { word: 'Documento', excel: 'Planilha', powerpoint: 'Apresentação' };
const editorType = (kind: OnlyOfficeKind) => kind === 'word' ? 'word' : kind === 'excel' ? 'cell' : 'slide';

export const OnlyOfficeEditor: React.FC<Props> = ({ project, kind, showNotification }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(Boolean(SERVER_URL));
  const scriptUrl = useMemo(() => SERVER_URL ? `${SERVER_URL}/web-apps/apps/api/documents/api.js` : '', []);

  useEffect(() => {
    let cancelled = false;
    let instance: { destroyEditor?: () => void } | null = null;
    setLoading(true); setError('');
    if (!SERVER_URL) { setConfigured(false); setLoading(false); return; }
    const load = async () => {
      try {
        if (!window.DocsAPI) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptUrl; script.async = true;
            script.onload = () => resolve(); script.onerror = () => reject(new Error('Não foi possível carregar a API do ONLYOFFICE Docs.'));
            document.head.appendChild(script);
          });
        }
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('Entre na sua conta para abrir este documento no ONLYOFFICE.');
        const response = await fetch(`${CONFIG_URL}?projectId=${encodeURIComponent(project.id)}&kind=${kind}`, { credentials: 'include', headers: { Accept: 'application/json', Authorization: `Bearer ${idToken}` } });
        if (!response.ok) throw new Error(`Configuração ONLYOFFICE indisponível (HTTP ${response.status}).`);
        const config = await response.json() as Record<string, unknown>;
        if (cancelled || !window.DocsAPI?.DocEditor) return;
        instance = new window.DocsAPI.DocEditor('orbidoc-onlyoffice-editor', {
          ...config, documentType: editorType(kind), type: 'desktop', height: '100%', width: '100%',
          events: {
            onDocumentReady: () => setLoading(false),
            onError: (event: { data?: { errorDescription?: string } }) => { setError(event.data?.errorDescription || 'O ONLYOFFICE reportou um erro ao abrir o arquivo.'); setLoading(false); },
            onRequestClose: () => showNotification?.('Editor encerrado.', 'success'),
          },
        });
        setConfigured(true);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Falha ao iniciar o ONLYOFFICE.'); setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; instance?.destroyEditor?.(); };
  }, [kind, project.id, scriptUrl, showNotification]);

  if (!configured) return <section className="h-full min-h-[560px] flex items-center justify-center bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800"><div className="max-w-xl px-6 py-10 text-center"><div className="mx-auto h-12 w-12 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 flex items-center justify-center"><IconSettings className="h-6 w-6" /></div><h2 className="mt-4 text-lg font-black">ONLYOFFICE ainda não foi conectado</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">O Orbit está preparado para usar o ONLYOFFICE como editor principal. O acesso usa sua conta Firebase e um bridge seguro para buscar e salvar o arquivo.</p><div className="mt-4 text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs leading-relaxed"><div className="font-black mb-2">Variáveis necessárias</div><div><code>VITE_ONLYOFFICE_DOCUMENT_SERVER_URL</code> — endereço público do ONLYOFFICE Docs.</div><div className="mt-1"><code>VITE_ONLYOFFICE_CONFIG_URL</code> — endpoint que gera a configuração segura do documento.</div><div className="mt-1">JWT e credenciais privadas devem permanecer no backend.</div></div><a href="https://api.onlyoffice.com/docs" target="_blank" rel="noreferrer" className="mt-5 inline-flex h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 items-center gap-2 text-xs font-bold"><IconExternalLink className="h-4 w-4" /> Documentação ONLYOFFICE</a></div></section>;

  return <section className="relative h-[calc(100dvh-7rem)] min-h-[560px] overflow-hidden bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800">
    {loading && !error ? <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 dark:bg-[#111318]/90 backdrop-blur-sm"><div className="flex items-center gap-2 text-xs font-bold"><IconLoader2 className="h-4 w-4 animate-spin text-violet-600" /> Abrindo {labels[kind]} no ONLYOFFICE…</div></div> : null}
    {error ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-white dark:bg-[#111318]"><div className="max-w-lg px-6 text-center"><IconAlertTriangle className="mx-auto h-8 w-8 text-amber-500" /><h2 className="mt-3 text-base font-black">Não foi possível abrir este arquivo</h2><p className="mt-2 text-xs text-slate-500">{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 h-9 px-3 rounded-lg bg-violet-600 text-white text-xs font-bold inline-flex items-center gap-2"><IconRefresh className="h-4 w-4" /> Tentar novamente</button></div></div> : null}
    <div id="orbidoc-onlyoffice-editor" className="h-full w-full" aria-label={`Editor ONLYOFFICE de ${labels[kind]}`} />
  </section>;
};
