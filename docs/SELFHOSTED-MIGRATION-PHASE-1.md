# Fase 1 — Gateway Ollama no backend

- Arquivos alterados: `api/_lib/ollamaNexus.ts`, `api/_lib/apiAuth.ts`, `server.ts`, `api/chat.ts`, `api/chat/stream.ts`, `api/health.ts`, `api/ai/models.ts`, `api/ai/status.ts`, `api/generate-image.ts`, `api/edit-image.ts`, `api/enhance-image.ts`, `api/_lib/nativeCors.ts`.
- Infraestrutura: gateway Ollama criado; auth opcional por `API_AUTH_TOKEN`; CORS nativo aceita Authorization.
- Contrato preservado: SSE `{chunk}`, `{meta}`, `[DONE]`; JSON de chat continua retornando `requestId`.
- Streaming: NDJSON Ollama, timeout de conexão 10s, timeout de ociosidade 45s, retry apenas antes do primeiro byte e cancelamento por desconexão.
- Contexto: truncamento aproximado para janela segura de ~6.000 tokens estimados.
- Modelos: `GET /api/ai/models` passa a consultar `/api/tags`, com fallback para `OLLAMA_MODEL`.
- Health/status: expõem gateway Ollama, disponibilidade do Ollama, modelo padrão/presença e estado da busca SearXNG.
- Express: limite JSON elevado de 12 MB para 20 MB.

## Gates executados

- lint: **PASS**
- typecheck: **PASS** após correção do controller de idle
- test: **82/83 PASS**
- build: **PASS via deployment Vercel READY** para o commit `56e9b6e6acf826c91320694fc4767d6a0e3d7194`
- verify:nexus: **falha esperada por guardas OpenRouter antigas**
- Android: o job chega até `verify:nexus` e para pela mesma guarda legada; nenhum erro Android novo foi introduzido antes desse gate.

## Falha de teste esperada

A única falha da suíte é `tests/nexusArchitecture.test.ts`, que ainda exige literalmente `nexusAI.complete` no `server.ts`. Isso é uma asserção de arquitetura OpenRouter anterior e será reescrito na Fase 5 com cobertura equivalente para Ollama, conforme o plano.

## Desvios

1. O Express e os handlers `api/*` foram migrados juntos para evitar gateways divergentes.
2. `nativeCors` precisou aceitar `Authorization` para suportar o modo opcional de Bearer token.
3. A geração/edição de imagem permanece temporariamente no runtime legado; a decisão de desativação/self-hosting será tratada na Fase 5, sem misturar a migração de texto com a remoção de imagem.

## Riscos/pendências

- SearXNG ainda não substituiu Tavily; isso é a Fase 2.
- `verify-nexus-ai.mjs` e testes ainda codificam a doutrina OpenRouter e serão migrados somente na Fase 5.
- Ainda não há Docker Compose/Dockerfile.
- Ainda não há seletor de modelos na UI.
- O Ollama real não está disponível no deployment Vercel; a validação end-to-end local depende do Compose da Fase 3.

- Commit de fechamento da fase: este relatório.
