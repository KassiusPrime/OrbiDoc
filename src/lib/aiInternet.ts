const FRESHNESS_RE = /\b(hoje|agora|atual(?:mente)?|recente(?:s)?|mais recente|últim[oa]s?|notícias?|news|latest|lançamento|lança(?:mento|r|do|da)?|estreia|estreou|quando (?:sai|lança|estreia)|data de (?:lançamento|estreia)|preço atual|versão atual|atualização|2026|2027)\b/i;
const EXPLICIT_WEB_RE = /\b(pesquis(?:e|ar)|busqu(?:e|ar)|procure|consulte|verifique)\b.{0,40}\b(internet|web|online|fontes?|sites?)\b|\b(internet|web)\b.{0,40}\b(pesquis(?:a|e)|busca|consulte)\b/i;

function lastUserText(body: any) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user' && typeof messages[index]?.content === 'string') return messages[index].content;
  }
  return '';
}

export function shouldUseAiInternet(body: any) {
  if (body?.webSearch === true) return true;
  if (body?.webSearch === false && body?.webSearchExplicit === true) return false;
  const text = lastUserText(body);
  return FRESHNESS_RE.test(text) || EXPLICIT_WEB_RE.test(text);
}

function withFreshnessContext(body: any, webSearch: boolean) {
  if (!webSearch || !Array.isArray(body?.messages)) return body;
  const currentDate = new Date().toISOString().slice(0, 10);
  const hasContext = body.messages.some((message: any) => message?.role === 'system' && String(message?.content || '').includes('PESQUISA_WEB_ORBIDOC'));
  if (hasContext) return { ...body, webSearch: true };
  return {
    ...body,
    webSearch: true,
    messages: [
      {
        role: 'system',
        content: `[PESQUISA_WEB_ORBIDOC] Data atual: ${currentDate}. Para fatos recentes, use a pesquisa na internet habilitada nesta requisição. Priorize fontes primárias/oficiais quando disponíveis, diferencie data de anúncio de data de lançamento e inclua links/fontes verificáveis. Não apresente como atual um fato que não foi confirmado pela pesquisa.`,
      },
      ...body.messages,
    ],
  };
}

async function readBody(init?: RequestInit) {
  if (!init?.body || typeof init.body !== 'string') return null;
  try { return JSON.parse(init.body); } catch { return null; }
}

export function installAiInternetAgent() {
  if (typeof window === 'undefined') return false;
  const marker = '__orbidocAiInternetInstalled';
  const target = window as any;
  if (target[marker]) return true;
  target[marker] = true;

  const downstreamFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let path = '';
    try {
      path = input instanceof Request ? new URL(input.url).pathname : new URL(String(input), window.location.href).pathname;
    } catch {
      path = String(input);
    }

    if ((path === '/api/chat' || path === '/api/chat/stream') && init?.method?.toUpperCase() === 'POST') {
      const body = await readBody(init);
      if (body) {
        const useWeb = shouldUseAiInternet(body);
        const nextBody = withFreshnessContext(body, useWeb);
        init = { ...init, body: JSON.stringify(nextBody) };
        if (useWeb) window.dispatchEvent(new CustomEvent('orbidoc:ai-web-search', { detail: { active: true, query: lastUserText(body) } }));
      }
    }

    return downstreamFetch(input as any, init);
  }) as typeof window.fetch;
  return true;
}
