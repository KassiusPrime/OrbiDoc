# Fase 2 — Busca Web via SearXNG

- `api/_lib/zeroCostWebSearch.ts` migrou de Tavily para SearXNG self-hosted.
- Timeout de busca: 8s.
- User-Agent: `Orbit-SelfHosted/1.0`.
- Até 5 resultados, snippet máximo de 400 caracteres.
- Falha, timeout ou ausência de `SEARXNG_URL`: degradação silenciosa.
- Evidências entram no prompt em `<web_data source="searxng_selfhosted" trust="untrusted">`.
- Adicionado teste de degradação e sanitização.

## Gate

- lint: verde no gate final.
- typecheck: verde no gate final.
- test: verde no gate final.
- build: verde no gate final.
- Desvio: o teste histórico de arquitetura OpenRouter permaneceu deliberadamente até a Fase 5.
