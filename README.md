# Orbit

Workspace local-first para documentos, arquivos e Nexus AI.

## Self-host com Docker

O caminho principal de produção self-hosted usa Docker Compose com três componentes internos:

- **Orbit app** — Express 5 + frontend Vite, única porta publicada (`3000`);
- **Ollama** — inferência local;
- **SearXNG** — busca Web opcional para evidências não confiáveis.

### Requisitos

- Docker Engine + Docker Compose v2;
- aproximadamente 4 GB de RAM livres para `llama3.2:3b`;
- espaço adicional para o modelo Ollama e os dados do SearXNG.

### Primeiro uso

1. Copie `.env.example` para `.env`.
2. Gere um segredo para o SearXNG:

```bash
openssl rand -hex 32
```

3. Coloque o valor em `SEARXNG_SECRET` e substitua o `CHANGE_ME_gerar_com_openssl_rand_hex_32` de `searxng/settings.yml` pelo mesmo valor.
4. Ajuste `OLLAMA_MODEL` se quiser outro modelo disponível no Ollama.
5. Suba tudo:

```bash
docker compose up -d --build
```

O serviço `ollama-init` baixa explicitamente o modelo configurado antes de iniciar o app. Isso evita o estado em que o Ollama aparece saudável, mas não possui nenhum modelo instalado.

### Verificação

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ai/models
```

A porta do Ollama e a porta 8080 do SearXNG não são publicadas pelo Compose; elas ficam apenas na rede interna.

### GPU NVIDIA (opcional)

Se o host possuir GPU NVIDIA, instale o NVIDIA Container Toolkit e descomente o bloco `deploy.resources.reservations.devices` do serviço `ollama` em `docker-compose.yml`.

### Autenticação

Defina `API_AUTH_TOKEN` para exigir `Authorization: Bearer <token>` nas rotas de chat e imagem. Se a variável ficar vazia, o servidor entra deliberadamente em modo LAN/CORS aberto, protegido pelo rate limit e pelas origens permitidas.

## Desenvolvimento

```bash
bun install
bun run dev
```

Os contratos de API existentes, incluindo o streaming SSE `{chunk}`/`{meta}`/`[DONE]`, são preservados durante a migração.
