# Orbit Android — Nexus AI E2E

Este gate cobre o caminho de rede que realmente importa para o APK:

`Capacitor WebView -> HTTPS Orbit API -> Nexus AI -> OpenRouter -> modelo gratuito -> resposta`

## Contrato nativo

- O APK continua local-first: `capacitor.config.json` não usa `server.url`.
- Web/PWA usam `/api/*` same-origin.
- Android/iOS resolvem `/api/chat` e `/api/chat/stream` para `VITE_ORBIT_API_ORIGIN`.
- Sem override, o fallback nativo é `https://doc-swiss.vercel.app`.
- Overrides nativos aceitam apenas origem HTTPS.
- Nenhuma chave OpenRouter entra no bundle/WebView/APK.
- O backend permite preflight dos origins Capacitor (`https://localhost` e `capacitor://localhost`).
- O projeto Android gerado precisa conter `android.permission.INTERNET`.

## Teste de produção

`.github/workflows/android-nexus-e2e.yml` roda após mudanças relevantes em `main` e:

1. espera a revisão de produção publicar o CORS do Capacitor;
2. envia `OPTIONS /api/chat` com `Origin: https://localhost`;
3. envia um `POST /api/chat` real com a mesma origem;
4. exige HTTP 200, `assistant = Nexus AI`, `freeOnly = true`, `requestId` e resposta não vazia;
5. consulta `/api/health` e exige ao menos um modelo gratuito saudável.

Esse teste não injeta `OPENROUTER_API_KEY` no GitHub Actions. A chave permanece somente no backend de produção da Vercel.
