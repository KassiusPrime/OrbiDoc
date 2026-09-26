# Fase 5 — Testes e invariantes

Migrado:

- `tests/nexusArchitecture.test.ts` para invariantes Ollama/SearXNG.
- `tests/aiRuntime.test.ts` para NDJSON, modelos, status e retry pré-stream.
- `tests/imageRuntime.test.ts` para geração/edição desativadas e Real-ESRGAN local.
- `scripts/verify-nexus-ai.mjs` para guardas positivas Ollama/SearXNG e negativas de provedores remotos.
- `scripts/verify-native-build.mjs` para Ollama self-hosted.
- removidos `api/_lib/nexusFreeAI.ts` e `api/_lib/nexusAI.ts`.
- timeout SSE do cliente convertido para timeout de ociosidade.

## Gate final

- 83 testes: **verde**.
- `verify:nexus`: **verde**.
- typecheck: **verde**.
- build: **verde**.
- native/mobile/auth: **verde**.

Nenhum teste foi silenciado ou ignorado para obter o resultado.
