# Migração Orbit/OrbiDoc — Relatório da Fase 0

## Fase 0 — Reconhecimento e inventário

**Base auditada:** branch `feat/selfhosted-ollama`, derivada de `main` em 26/09/2026. Commit-base observado: `91aaf40a5f609b9c9d809d6407dfc673a357e8a0`.

## Arquivos auditados

- `server.ts`
- `api/_lib/nexusFreeAI.ts`
- `api/_lib/nexusAI.ts`
- `api/_lib/zeroCostWebSearch.ts`
- `api/_lib/nativeCors.ts`
- `src/api/chat.ts`
- `src/components/AiWorkspace.tsx`
- `src/components/AiRuntimeStatus.tsx`
- `scripts/verify-nexus-ai.mjs`
- `.env.example`
- `.github/workflows/ci.yml`
- `package.json`
- `api/chat.ts`
- `api/chat/stream.ts`
- `api/health.ts`
- `api/ai/models.ts`
- `api/ai/status.ts`
- `api/_lib/imageRuntime.ts`
- `src/lib/ocrEngineImpl.ts`
- `src/lib/ocrEngine.ts`
- `src/lib/utils.ts`
- `src/lib/aiInternet.ts`
- `src/lib/nativeAndroidBridge.ts`
- `vite.config.ts`
- testes diretamente relacionados ao gateway.

## Mapa: o que entra / sai / permanece

### Entra

- `api/_lib/ollamaNexus.ts` como novo gateway canônico.
- `OLLAMA_API_URL`, `OLLAMA_MODEL`, `SEARXNG_URL`, `SEARXNG_SECRET` e `API_AUTH_TOKEN`.
- SearXNG self-hosted como camada opcional de evidências Web.
- Seletor de modelo instalado localmente, persistido em `localStorage`.
- Docker Compose com `app`, `ollama`, `ollama-init` e `searxng`.
- Bootstrap explícito de modelo via `ollama pull`.
- Auth opcional por Bearer token conforme a decisão arquitetural do plano.
- Limite de upload exposto ao cliente por `VITE_MAX_UPLOAD_MB`.

### Sai do caminho de runtime

- OpenRouter como gateway de inferência.
- Tavily como busca Web.
- Circuit breakers específicos de modelos remotos OpenRouter.
- Invariante de preço zero baseada em `max_price`.
- Seleção interna de modelos OpenRouter.

### Permanece

- Contrato SSE externo: `data: {"chunk": ...}`, `data: {"meta": ...}`, `data: [DONE]`.
- Rotas públicas `/api/chat`, `/api/chat/stream`, `/api/health`, `/api/ai/models` e `/api/ai/status`.
- `requestId` da resposta JSON de chat.
- `src/main.tsx -> src/AppV5.tsx`.
- Nexus AI como assistente.
- Android/Capacitor usando `VITE_ORBIT_API_ORIGIN` e `nativeCors`.
- Firebase Auth/Firestore.
- OnlyOffice.
- OAuth GitHub/Google/Microsoft.
- PWA/offline e assets Tesseract/PDF.
- Real-ESRGAN.
- Identidade/branding Orbit.
- Contrato de consumo SSE existente no frontend.

## Backend atual

`server.ts` é de fato o servidor Express 5 principal. Ele já possui:

- rate limit em memória;
- `express.json({ limit: '12mb' })`;
- `POST /api/chat`;
- `POST /api/chats`;
- `POST /api/chat/stream` com SSE;
- `GET /api/health`;
- `GET /api/ai/models`;
- `GET /api/ai/status`;
- endpoints de imagem;
- OAuth GitHub;
- Vite em desenvolvimento;
- `dist/` em produção.

### Desvio confirmado

Os módulos Vercel-style em `api/` continuam implementados e precisam ser mantidos sincronizados durante a migração. O plano original os trata como equivalentes, mas o repositório atual efetivamente mantém duas superfícies de backend: Express e handlers `api/*`.

## Gateway atual

`api/_lib/nexusFreeAI.ts` é o runtime OpenRouter free-only. Ele:

- usa pool de cinco rotas OpenRouter;
- exige `OPENROUTER_API_KEY`;
- usa `max_price.prompt = 0` e `max_price.completion = 0`;
- rejeita custo reportado maior que zero;
- usa circuit breaker;
- chama Tavily para pesquisa Web;
- simula streaming após uma resposta completa.

`api/_lib/nexusAI.ts` é uma superfície de compatibilidade que delega ao runtime acima e ainda expõe `NEXUS_FREE_MODELS`, `assertFreeModel` e `CircuitBreaker`.

### Migração necessária

A Fase 1 deve substituir o uso efetivo por Ollama sem alterar o contrato externo. A remoção física dos dois arquivos fica corretamente reservada à Fase 5.

## Busca Web atual

`api/_lib/zeroCostWebSearch.ts` usa Tavily via POST e retorna:

- query;
- até 6 fontes;
- título;
- URL;
- conteúdo;
- score opcional;
- engine `tavily-free`.

O formato público pode ser preservado, mas o engine e a implementação devem passar para SearXNG.

## Frontend atual

`src/api/chat.ts` já consome:

- `/api/chat`;
- `/api/chat/stream`;
- `ReadableStream.getReader()`;
- frames SSE `chunk`, `meta` e `[DONE]`;
- frame `error`.

Portanto, **não há necessidade de reescrever o parser SSE na Fase 4**. A mudança principal será adicionar o modelo local selecionável e adaptar metadados/estado.

`AiWorkspace.tsx` atualmente:

- usa Nexus AI;
- não possui seletor de modelo;
- possui streaming incremental;
- possui Web;
- possui leitura de link;
- possui anexos;
- persiste histórico/rascunho;
- usa Virtuoso.

## Auth/CORS

`api/_lib/nativeCors.ts` permite:

- `https://localhost`;
- `capacitor://localhost`;
- localhost em desenvolvimento.

Os handlers Vercel-style de chat aplicam esse CORS. O `server.ts` Express principal ainda não usa esse helper.

### Desvio importante

A decisão de Auth opcional precisa ser aplicada de modo compatível nas duas superfícies. Não se deve colocar Bearer obrigatório incondicionalmente no Express, pois isso divergiria do contrato atual do Android.

## Imagens

`api/_lib/imageRuntime.ts` ainda chama diretamente OpenRouter para geração/edição e usa `OPENROUTER_FREE_IMAGE_MODEL`.

Isso **não está restrito ao gateway de texto**. Na Fase 5, a rota deve permanecer explicitamente desativada com erro claro quando não houver uma implementação self-hosted gratuita equivalente, conforme o plano, e Real-ESRGAN deve permanecer intacto.

Teste diretamente relacionado: `tests/imageRuntime.test.ts`.

## OCR

`src/lib/ocrEngine.ts` carrega dinamicamente `ocrEngineImpl`.

`src/lib/ocrEngineImpl.ts` usa `Tesseract.recognize()` e já possui:

- progresso;
- assets locais no runtime nativo;
- worker/core/lang paths para Android.

Não existe `createWorker()` explícito no código pesquisado.

### Decisão

Não criar um worker manual redundante na Fase 4. Preservar a implementação Tesseract atual e adicionar somente limite de upload/observabilidade se necessário.

Há também um caminho legado em `src/lib/utils.ts` que usa `Tesseract.recognize()`; ele deve ser preservado e auditado antes de qualquer consolidação futura.

## PDF

Foram encontrados usos de `pdf.addImage()` em:

- `src/components/DesignEditorPro.tsx`;
- `src/components/DesignEditorStudio.tsx`;
- `src/components/PresentationEditorPro.tsx`;
- `src/components/PresentationEditorStudio.tsx`;
- `src/lib/documentScanner.ts`;
- `src/lib/fileConversionV2.ts`.

Os pontos explicitamente auditados usam PNG→PNG ou JPEG→JPEG nos fluxos principais. `PresentationEditorPro.tsx` usa uma variável de dados já pronta e precisa de inspeção contextual na Fase 4.

## Tradução

Existe o tipo `AiActionType = 'translate'` em `src/types.ts`, mas a busca por implementação textual de `translation` não encontrou um fluxo claro de tradução no gateway atual.

Também existe documentação antiga de Google Translate.

### Decisão

Não criar feature de tradução na migração. Na Fase 4, localizar o fluxo efetivo antes de aplicar chunking; se não houver chamada real de IA, registrar como não aplicável.

## Referências legadas encontradas

Busca de código encontrou referências atuais a OpenRouter/Tavily em:

- `api/_lib/nexusFreeAI.ts`;
- `api/_lib/nexusAI.ts`;
- `api/_lib/zeroCostWebSearch.ts`;
- `api/ai/models.ts`;
- `api/ai/status.ts`;
- `api/health.ts`;
- `api/chat.ts`;
- `api/chat/stream.ts`;
- `server.ts`;
- `src/api/chat.ts`;
- `src/components/AiWorkspace.tsx`;
- `src/components/AiRuntimeStatus.tsx`;
- `scripts/verify-nexus-ai.mjs`;
- `scripts/verify-native-build.mjs`;
- `.env.example`;
- `api/_lib/imageRuntime.ts`;
- testes de runtime;
- documentação histórica;
- `src/lib/nativeAndroidBridge.ts`;
- `src/orbidoc-native-ui.css`;
- `src/components/OfficeSuiteHub.tsx`.

O card de `OfficeSuiteHub.tsx` ainda exibe “Conecte Gemini, Groq ou OpenRouter”, confirmando o legado de UI citado pelo plano.

Há também documentação/artefatos históricos que mencionam OpenRouter, Gemini ou Groq. A limpeza final deverá distinguir runtime ativo de histórico, conforme a regra da Fase 6.

## Testes que tocam o gateway

### `tests/nexusArchitecture.test.ts`

Valida:

- Nexus como runtime único;
- ausência de seletor interno;
- OpenRouter free-only;
- `max_price = 0`;
- `allow_fallbacks = false`;
- invariante de custo;
- pesquisa centralizada;
- Android sem runtime paralelo.

**Fase 5:** substituir por invariantes Ollama/self-hosted equivalentes.

### `tests/aiRuntime.test.ts`

Valida:

- pool de modelos OpenRouter;
- rejeição de modelos pagos;
- CircuitBreaker.

**Fase 5:** substituir por testes do adaptador Ollama, status, modelos e retry/idle-timeout/cancelamento.

### `tests/imageRuntime.test.ts`

Valida:

- modelo de imagem OpenRouter :free;
- bloqueio de modelo pago;
- custo zero.

**Fase 5:** migrar para o comportamento decidido: Real-ESRGAN self-hosted quando aplicável e 503 explícito para geração/edição que não possuam rota self-hosted disponível.

### `tests/product-workspaces.test.ts`

Valida:

- Nexus AI na UI;
- ausência de seletor antigo;
- streaming/UI;
- referências ao runtime gratuito.

**Fase 5/4:** atualizar somente as invariantes arquiteturais afetadas, mantendo a cobertura de UX.

### `tests/onlyoffice-copilot.test.ts`

Não é teste de gateway de IA, mas é parte crítica do produto e deve permanecer intacto conforme a regra global de não tocar em OnlyOffice.

### `tests/androidNexusNetwork.test.ts`

Existe cobertura de origem/endpoints Android e deve permanecer verde. A migração deve preservar `orbitApiUrl('/api/chat')` e `orbitApiUrl('/api/chat/stream')`.

## CI atual

`.github/workflows/ci.yml` já existe e possui:

- Bun;
- lint;
- typecheck;
- test;
- verify:nexus;
- build;
- verify:pwa;
- verify:playstore;
- verify:native;
- verify:mobile;
- verify:auth;
- build APK Android.

### Desvio confirmado

O workflow atual usa `bun install`, não `bun install --frozen-lockfile`. Isso deve ser corrigido apenas quando a Fase 6 tratar o CI, não na Fase 0.

O workflow também contém instalação pontual via `npm install --no-save --package-lock=false` para ferramentas Capacitor/Android; isso não deve ser confundido com o gerenciador de dependências principal do projeto.

## Dependências e build

`package.json` confirma:

- Bun como scripts/lockfile;
- Express 5;
- React 19;
- Vite 7;
- Tesseract.js 7;
- jsPDF;
- docx;
- xlsx;
- pptxgenjs;
- Firebase;
- Capacitor por workflow/ambiente nativo.

Não existe `package-lock.json` no contrato do projeto; `bun.lock` é o lockfile principal.

## Docker/Self-hosted

Busca de código não encontrou:

- `Dockerfile` na raiz;
- `docker-compose.yml`;
- referências atuais a Ollama;
- referências atuais a SearXNG;
- `VITE_MAX_UPLOAD_MB`;
- `MAX_UPLOAD_MB`.

Logo a infraestrutura do Apêndice A/B/C ainda precisa ser introduzida nas fases posteriores.

## Desvios do plano

1. O backend Express é real e deve continuar sendo a superfície principal; os handlers `api/*` permanecem como segunda superfície compatível.
2. O helper `nativeCors` existe e está ativo nos handlers Vercel-style, mas não está aplicado ao Express.
3. O OCR possui dois caminhos: `ocrEngineImpl` e `utils.ts`; ambos devem ser preservados.
4. O repositório possui mais referências históricas a OpenRouter/Gemini/Groq do que o escopo mínimo do plano, incluindo documentação e CSS nativo. A limpeza final deverá separar histórico de runtime.
5. O teste de imagem atual é fortemente acoplado ao OpenRouter e exigirá substituição legítima de cobertura na Fase 5.
6. O plano cita “13 gates”; o workflow atual deve ser tratado pelo conteúdo real dos jobs, não por essa contagem textual.

## Gate da Fase 0

- Alteração de código: **nenhuma**.
- Branch dedicada criada: **sim** — `feat/selfhosted-ollama`.
- Inventário realizado: **sim**.
- Contratos críticos identificados: **sim**.
- Riscos de migração identificados: **sim**.
- Próxima fase autorizada: **Fase 1**, condicionada à execução dos gates nela definidos.
