# Fase 3 — Docker e runtime self-hosted

Arquivos introduzidos:

- `Dockerfile` multi-stage Bun build → Node runtime.
- `docker-compose.yml` com `app`, `ollama`, `ollama-init` e `searxng`.
- `.dockerignore`.
- `searxng/settings.yml`.
- README e `.env.example` documentando o runtime.

Decisões relevantes:

- somente `app:3000` é publicado;
- Ollama e SearXNG ficam na rede interna;
- `ollama-init` executa `ollama pull "$OLLAMA_MODEL"`;
- app depende da conclusão bem-sucedida do bootstrap;
- SearXNG aceita JSON;
- segredo SearXNG deve ser gerado com `openssl rand -hex 32`.

## Gate

- `docker compose config`: **verde**.
- `docker build .`: **verde**.
- Os dois foram executados no novo job `docker-self-hosted` do CI.
- Execução end-to-end com Ollama real dentro do Compose ainda depende de infraestrutura self-hosted disponível; não foi falsamente simulada no CI.
