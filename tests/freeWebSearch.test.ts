import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  decodeHtmlEntities,
  extractSearchQuery,
  normalizeDuckDuckGoUrl,
  parseDuckDuckGoResults,
  runFreeWebSearchChat,
} from '../api/_lib/freeWebSearch';

const read = (path: string) => readFileSync(path, 'utf8');

const HTML_ENDPOINT_FIXTURE = `
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fnoticia%3Fid%3D7%26ref%3Dddg&amp;rut=abc">Exemplo &amp; Not&iacute;cia &mdash; Manchete</a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fnoticia%3Fid%3D7&amp;rut=abc">Trecho com <b>destaque</b> e &quot;aspas&quot; &hellip;</a>
</div>
<div class="result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="https://direct.example.org/pagina">Fonte direta</a>
  </h2>
  <a class="result__snippet" href="https://direct.example.org/pagina">Segundo trecho</a>
</div>
`;

const LITE_ENDPOINT_FIXTURE = `
<tr>
  <a rel="nofollow" href="https://lite.example.net/resultado" class='result-link'>Resultado Lite</a>
</tr>
<tr>
  <td class='result-snippet'>Trecho do lite</td>
</tr>
`;

test('parser extrai títulos, URLs reais e trechos do endpoint HTML do DuckDuckGo', () => {
  const results = parseDuckDuckGoResults(HTML_ENDPOINT_FIXTURE);
  assert.equal(results.length, 2);
  assert.equal(results[0].url, 'https://example.com/noticia?id=7&ref=ddg');
  assert.equal(results[0].title, 'Exemplo & Notícia — Manchete');
  assert.equal(results[0].snippet, 'Trecho com destaque e "aspas" …');
  assert.equal(results[1].url, 'https://direct.example.org/pagina');
  assert.equal(results[1].snippet, 'Segundo trecho');
});

test('parser também suporta o endpoint Lite do DuckDuckGo', () => {
  const results = parseDuckDuckGoResults(LITE_ENDPOINT_FIXTURE);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, 'https://lite.example.net/resultado');
  assert.equal(results[0].title, 'Resultado Lite');
  assert.equal(results[0].snippet, 'Trecho do lite');
});

test('parser respeita o limite de resultados e ignora URLs inválidas', () => {
  // URLs repetidas são deduplicadas de propósito (mesma página no resultado).
  const deduped = parseDuckDuckGoResults(HTML_ENDPOINT_FIXTURE.repeat(5));
  assert.equal(deduped.length, 2);

  const uniqueFixture = Array.from({ length: 6 }, (_unused, index) =>
    `<a class="result__a" href="https://exemplo.com/${index}">Resultado ${index}</a>`).join('');
  const limited = parseDuckDuckGoResults(uniqueFixture, 4);
  assert.equal(limited.length, 4);

  const invalid = parseDuckDuckGoResults('<a class="result__a" href="javascript:alert(1)">Título</a>');
  assert.equal(invalid.length, 0);
});

test('normalizador decodifica redirecionamentos do DuckDuckGo e rejeita esquemas não http', () => {
  assert.equal(normalizeDuckDuckGoUrl('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexemplo.com%2Fa'), 'https://exemplo.com/a');
  assert.equal(normalizeDuckDuckGoUrl('https://exemplo.com/b'), 'https://exemplo.com/b');
  assert.equal(normalizeDuckDuckGoUrl('ftp://exemplo.com/c'), '');
  assert.equal(normalizeDuckDuckGoUrl('javascript:alert(1)'), '');
});

test('decodeHtmlEntities cobre entidades nomeadas, acentos do português e numéricas', () => {
  assert.equal(decodeHtmlEntities('a&amp;b &lt;c&gt; &#x27;d&#39; &nbsp;&hellip;'), "a&b <c> 'd'  …");
  assert.equal(decodeHtmlEntities('&Aacute;gua &ntilde; &ccedil;&atilde;o &iacute;psilon'), 'Água ñ ção ípsilon');
  assert.equal(decodeHtmlEntities('caf&#233; &#x41;&#x42;'), 'café AB');
});

test('extractSearchQuery remove blocos de arquivo anexado do copiloto', () => {
  const raw = 'Resuma o contexto abaixo\n\n[Arquivo: contrato.docx]\ntrecho longo do contrato…\n[Fim do arquivo]';
  assert.equal(extractSearchQuery(raw), 'Resuma o contexto abaixo');

  const unclosed = 'Analise [Arquivo: nota.txt]\nconteúdo solto';
  assert.equal(extractSearchQuery(unclosed), 'Analise');

  assert.equal(extractSearchQuery('  pergunta   simples  '), 'pergunta simples');
});

test('runtime V2 expõe o motor gratuito sem exigir credencial', () => {
  const runtime = read('api/_lib/aiRuntimeV2.ts');
  const freeWeb = read('api/_lib/freeWebSearch.ts');

  assert.match(runtime, /'free'/);
  assert.match(runtime, /orbidoc\/web-free/);
  assert.match(runtime, /provider === 'free'\) return true/);
  assert.match(runtime, /requestFree/);
  assert.match(runtime, /runFreeWebSearchChat/);

  // A síntese pelo Gateway é opcional: sem credencial, o motor devolve resultados com fontes.
  assert.match(freeWeb, /synthesizeWithGateway/);
  assert.match(freeWeb, /lite\.duckduckgo\.com/);
  assert.match(freeWeb, /html\.duckduckgo\.com/);
  assert.match(freeWeb, /### Fontes/);
});

test('runFreeWebSearchChat devolve resultados com fontes mesmo sem síntese nem credencial', async (t) => {
  const originalFetch = globalThis.fetch;
  const searchCalls: string[] = [];
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    searchCalls.push(url);
    if (url.startsWith('https://lite.duckduckgo.com/')) {
      return new Response('<a rel="nofollow" href="https://exemplo.com/resultado" class=\'result-link\'>Resultado da busca</a><td class=\'result-snippet\'>Trecho do resultado</td>', { status: 200 });
    }
    throw new Error(`URL inesperada no teste: ${url}`);
  }) as typeof fetch;

  const result = await runFreeWebSearchChat({
    messages: [{ role: 'user', content: 'O que é o OrbiDoc?' }],
  });

  assert.equal(result.synthesized, false);
  assert.equal(result.sourceCount, 1);
  assert.equal(result.routedModel, 'duckduckgo-lite');
  assert.match(result.answer, /Resultado da busca/);
  assert.match(result.answer, /### Fontes/);
  assert.match(result.answer, /\[Resultado da busca\]\(https:\/\/exemplo\.com\/resultado\)/);
  assert.ok(searchCalls.length >= 1);
});

test('runFreeWebSearchChat exige uma pergunta do usuário', async () => {
  await assert.rejects(
    () => runFreeWebSearchChat({ messages: [{ role: 'assistant', content: 'oi' }] }),
    /precisa de uma pergunta/,
  );
});

test('Pesquisa Web gratuita é o motor padrão e aparece com selo gratuito na interface', () => {
  const workspace = read('src/components/AiWorkspace.tsx');
  const diagnostics = read('src/components/AiDiagnosticsPanel.tsx');

  // Motor gratuito é a primeira opção de pesquisa (fallback para os outros quando existirem).
  assert.match(workspace, /model\.provider === 'free'\)/);
  assert.match(workspace, /OrbiDoc Web · Grátis/);
  assert.match(workspace, /Gratuito para todos/);
  assert.match(workspace, /Tentar novamente/);
  // Acessibilidade: tabs com papéis ARIA e estados de carregamento anunciados.
  assert.match(workspace, /role="tablist"/);
  assert.match(workspace, /aria-selected/);
  assert.match(workspace, /aria-busy="true"/);

  assert.match(diagnostics, /'free'/);
  assert.match(diagnostics, /Gratuito · sem chave · sempre ativo/);
});
