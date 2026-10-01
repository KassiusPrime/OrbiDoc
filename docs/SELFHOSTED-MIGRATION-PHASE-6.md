# Fase 6 — CI/CD e limpeza final

- CI existente atualizado; nenhum workflow paralelo foi criado.
- Adicionado gate `docker-self-hosted`.
- `docker compose config` e `docker build .` passam no CI.
- Dependência `@openrouter/ai-sdk-provider` removida do `package.json` e `bun.lock`.
- variáveis `OPENROUTER_API_KEY`, `TAVILY_API_KEY` e `OPENROUTER_FREE_IMAGE_MODEL` removidas do `.env.example`.
- workflows/documentação ativa de Android ajustados para Ollama.
- E2E Android de Nexus convertido para execução manual contra uma origem self-hosted fornecida.
- privacidade/Play Store atualizadas para inferência local.
- auditoria mobile ajustada para o seletor de modelo local permitido.

## Gate

Run final `Orbit CI #1243`: **success** em todos os jobs:

- verify;
- native-android-apk;
- docker-self-hosted.

