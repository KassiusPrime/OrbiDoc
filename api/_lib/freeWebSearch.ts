import { resolveGatewayCredential } from './gatewayAuth.js';

/**
 * OrbiDoc Web Livre — motor de pesquisa web gratuito para todos.
 *
 * Funciona em dois níveis, sempre sem exigir chave do usuário:
 *  1. Busca keyless no DuckDuckGo (endpoint HTML/Lite, sem API key).
 *  2. Síntese da resposta com o modelo gratuito do Vercel AI Gateway
 *     (autenticado por OIDC na Vercel; zero configuração).
 *
 * Se a síntese não estiver disponível (ambiente local sem credencial),
 * o motor devolve os resultados estruturados com trechos e fontes —
 * útil, citado e 100% gratuito.
 */

const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1';
const GATEWAY_FREE_MODEL = 'inclusionai/ling-3.0-flash-free';
const SEARCH_TIMEOUT_MS = 12_000;
const SYNTHESIS_TIMEOUT_MS = 35_000;
const MAX_RESULTS = 8;
const MAX_QUERY_CHARS = 400;

export type FreeWebSource = { title: string; url: string; snippet: string };

export type FreeWebResult = {
  answer: string;
  model: string;
  routedModel?: string;
  synthesized: boolean;
  sourceCount: number;
};

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
};

/** Entidades nomeadas comuns, incluindo acentos do português. */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', middot: '·', bull: '•',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', yacute: 'ý',
  agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  atilde: 'ã', otilde: 'õ', ntilde: 'ñ', ccedil: 'ç', aelig: 'æ', oslash: 'ø',
  auml: 'ä', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü',
  Aring: 'Å', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  Atilde: 'Ã', Otilde: 'Õ', Ccedil: 'Ç', deg: '°', copy: '©', reg: '®', trade: '™',
};

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_all, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_all, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (all, name: string) => NAMED_ENTITIES[name] ?? all);
}

function stripTags(fragment: string): string {
  return decodeHtmlEntities(fragment.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Resolve links de redirecionamento do DuckDuckGo (//duckduckgo.com/l/?uddg=…) para a URL real. */
export function normalizeDuckDuckGoUrl(href: string): string {
  let url = decodeHtmlEntities(href.trim());
  if (url.startsWith('//')) url = `https:${url}`;
  try {
    const parsed = new URL(url, 'https://duckduckgo.com');
    const target = parsed.searchParams.get('uddg');
    if (target && /^https?:\/\//i.test(target)) return target;
    if (/^https?:\/\//i.test(parsed.toString())) return parsed.toString();
  } catch {
    // URL inválida: cai fora.
  }
  return /^https?:\/\//i.test(url) ? url : '';
}

/** Extrai resultados do HTML do DuckDuckGo (endpoints html/ e lite/). */
export function parseDuckDuckGoResults(html: string, limit = MAX_RESULTS): FreeWebSource[] {
  const sources: FreeWebSource[] = [];

  const anchorRe = /<a\b([^>]*\bclass\s*=\s*["'](?:result__a|result-link)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  const anchors: Array<{ href: string; title: string }> = [];
  for (let match = anchorRe.exec(html); match; match = anchorRe.exec(html)) {
    const attrs = match[1];
    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const url = normalizeDuckDuckGoUrl(hrefMatch[1]);
    const title = stripTags(match[2]);
    if (url && title) anchors.push({ href: url, title });
  }

  const snippetRe = /<(?:a|td)\b[^>]*\bclass\s*=\s*["'](?:result__snippet|result-snippet)["'][^>]*>([\s\S]*?)<\/(?:a|td)>/gi;
  const snippets: string[] = [];
  for (let match = snippetRe.exec(html); match; match = snippetRe.exec(html)) {
    const snippet = stripTags(match[1]);
    if (snippet) snippets.push(snippet);
  }

  const seen = new Set<string>();
  for (let index = 0; index < anchors.length && sources.length < limit; index += 1) {
    const anchor = anchors[index];
    if (seen.has(anchor.href)) continue;
    seen.add(anchor.href);
    sources.push({ title: anchor.title, url: anchor.href, snippet: snippets[index] || '' });
  }
  return sources;
}

async function fetchText(url: string, timeoutMs: number, init?: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: BROWSER_HEADERS });
    if (!response.ok) throw new Error(`Busca web ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Busca keyless no DuckDuckGo: tenta o endpoint Lite e cai para o HTML completo. */
export async function searchDuckDuckGo(query: string, limit = MAX_RESULTS): Promise<FreeWebSource[]> {
  const encoded = encodeURIComponent(query.slice(0, MAX_QUERY_CHARS));
  const candidates = [
    `https://lite.duckduckgo.com/lite/?q=${encoded}`,
    `https://html.duckduckgo.com/html/?q=${encoded}`,
  ];

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const html = await fetchText(candidate, SEARCH_TIMEOUT_MS);
      const results = parseDuckDuckGoResults(html, limit);
      if (results.length) return results;
      lastError = new Error('A busca não retornou resultados utilizáveis.');
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Motor gratuito temporariamente indisponível (${lastError instanceof Error ? lastError.message : 'erro desconhecido'}). Tente novamente em instantes ou use um provedor configurado.`,
  );
}

function lastUserText(messages: Array<{ role?: string; content?: unknown }>): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user' && typeof message.content === 'string' && message.content.trim()) {
      return message.content.trim();
    }
  }
  return '';
}

/** Limpa a pergunta para virar query de busca: remove blocos de arquivo anexado e ruído de prompt. */
export function extractSearchQuery(rawText: string): string {
  return rawText
    .replace(/\[Arquivo:[^\]]*\][\s\S]*?\[Fim do arquivo\]/gi, ' ')
    .replace(/\[Arquivo:[^\]]*\][\s\S]*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function sourcesBlock(sources: FreeWebSource[]): string {
  return sources.map((source) => `- [${source.title.replace(/[\[\]]/g, '')}](${source.url})`).join('\n');
}

function contextBlock(sources: FreeWebSource[]): string {
  return sources
    .map((source, index) => `[${index + 1}] ${source.title} (${domainOf(source.url)})\nURL: ${source.url}\nTrecho: ${source.snippet || '(sem trecho disponível)'}`)
    .join('\n\n');
}

function structuredAnswer(query: string, sources: FreeWebSource[], reason: string): string {
  const lines = [
    `### Resultados da web para “${query}”`,
    '',
    `Encontrei ${sources.length} fonte(s) na internet. ${reason}`,
    '',
    ...sources.flatMap((source) => [
      `**${source.title}** · ${domainOf(source.url)}`,
      source.snippet ? `${source.snippet}` : '_Sem trecho disponível._',
      '',
    ]),
    '### Fontes',
    sourcesBlock(sources),
  ];
  return lines.join('\n').trim();
}

async function synthesizeWithGateway(
  query: string,
  sources: FreeWebSource[],
  messages: Array<{ role?: string; content?: unknown }>,
  systemPrompt?: string,
): Promise<string | null> {
  const credential = await resolveGatewayCredential();
  if (!credential.token) return null;

  const conversation = messages
    .filter((message) => typeof message?.content === 'string' && message.content.trim())
    .slice(-6)
    .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user', content: String(message.content).slice(0, 4_000) }));

  const payload = {
    model: GATEWAY_FREE_MODEL,
    stream: false,
    messages: [
      {
        role: 'system',
        content:
          systemPrompt ||
          'Você é o modo Pesquisa Web Livre do OrbiDoc. Responda com clareza em português do Brasil usando APENAS os resultados de busca fornecidos. Cite as fontes com [número] ao usar cada informação, separe fatos confirmados de inferências e avise quando os resultados não forem suficientes. Nunca invente URLs.',
      },
      ...conversation,
      {
        role: 'user',
        content: `Pergunta: ${query}\n\nResultados da busca na web (DuckDuckGo):\n\n${contextBlock(sources)}\n\nResponda à pergunta com base nesses resultados e cite as fontes usadas.`,
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNTHESIS_TIMEOUT_MS);
  try {
    const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.token}`,
        'Content-Type': 'application/json',
        'X-Vercel-AI-Gateway-App': 'OrbiDoc',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Gateway ${response.status}: ${text.slice(0, 200)}`);
    const data: any = JSON.parse(text || '{}');
    const answer = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!answer) throw new Error('Síntese gratuita sem conteúdo.');
    return answer;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executa o chat com pesquisa web gratuita. Nunca exige chave do usuário:
 * sem credencial de Gateway, devolve os resultados estruturados com fontes.
 */
export async function runFreeWebSearchChat(body: {
  messages?: Array<{ role?: string; content?: unknown }>;
  systemPrompt?: string;
}): Promise<FreeWebResult> {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const query = extractSearchQuery(lastUserText(messages));
  if (!query) throw new Error('A pesquisa web gratuita precisa de uma pergunta.');

  const searchQuery = query.slice(0, MAX_QUERY_CHARS);

  const sources = await searchDuckDuckGo(searchQuery);
  if (!sources.length) throw new Error('A busca gratuita não encontrou resultados para esta pergunta.');

  let synthesized = false;
  let answer: string | null = null;
  try {
    answer = await synthesizeWithGateway(searchQuery, sources, messages, body?.systemPrompt);
    synthesized = Boolean(answer);
  } catch {
    // A síntese é opcional: o motor continua gratuito e útil sem ela.
    answer = null;
  }

  if (!answer) {
    answer = structuredAnswer(
      searchQuery,
      sources,
      'A síntese com IA não está disponível neste ambiente, então aqui está o resumo direto dos trechos de cada fonte:',
    );
  } else if (!/(?:^|\n)#{2,3}\s+Fontes\b/i.test(answer)) {
    answer = `${answer}\n\n### Fontes\n${sourcesBlock(sources)}`;
  }

  return {
    answer,
    model: 'orbidoc/web-free',
    routedModel: synthesized ? GATEWAY_FREE_MODEL : 'duckduckgo-lite',
    synthesized,
    sourceCount: sources.length,
  };
}
