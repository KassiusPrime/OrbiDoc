# OrbiDoc — Android direto e Google Play

O OrbiDoc usa uma única base React/Vite, mas o Android **não depende de TWA**. A distribuição Android principal é um app Capacitor 8 que inclui o build `dist/` dentro do APK/AAB.

Isso significa que o OrbiDoc instalado consegue abrir e executar o núcleo local mesmo se Vercel, domínio ou backend estiverem indisponíveis.

## Identidade Android

- Nome: `OrbiDoc`
- Package/Application ID: `app.orbidoc.workspace`
- Runtime: Capacitor 8
- Target SDK: Android 16 / API 36
- Web assets: `dist/` empacotado localmente
- `server.url`: **não configurado**

`capacitor.config.json` é a fonte principal da identidade do app nativo.

## APK debug x release

O APK debug é para desenvolvimento/teste. Ele é instalável, mas sua assinatura não deve ser usada como identidade definitiva de distribuição.

A distribuição estável precisa de **uma chave privada permanente**.

O workflow `.github/workflows/android-native.yml` espera estes GitHub Actions Secrets:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

Com os quatro Secrets configurados, o modo `release` gera:

```text
OrbiDoc-release.apk
OrbiDoc-release.aab
OrbiDoc-release.sha256
```

O workflow executa também `apksigner verify --verbose --print-certs` no APK release.

- `APK`: instalação direta fora da loja.
- `AAB`: pacote para envio ao Google Play.

Sem esses Secrets, uma solicitação de release é convertida explicitamente em APK debug para que o CI continue validando o app sem fingir que existe uma assinatura permanente.

## Android App Links e assetlinks.json

**`assetlinks.json` não é requisito para compilar ou publicar um AAB Capacitor nativo.**

Digital Asset Links só entra quando o OrbiDoc quiser verificar links HTTPS de um domínio para que o Android os abra diretamente no app.

Configuração opcional:

```text
ANDROID_APP_LINKS_ENABLED=false
ANDROID_SHA256_CERT_FINGERPRINT=
```

Com `ANDROID_APP_LINKS_ENABLED=false`, o build publica deliberadamente:

```json
[]
```

em `/.well-known/assetlinks.json`. Isso não torna o APK/AAB incompleto.

Para habilitar App Links:
1. tenha a chave/certificado de produção definitivo;
2. defina `ANDROID_APP_LINKS_ENABLED=true`;
3. forneça o SHA-256 do certificado de assinatura;
4. se o app for distribuído pela Play com Play App Signing, use o fingerprint do certificado **App Signing** mostrado na Play Console;
5. publique `assetlinks.json` no domínio HTTPS correspondente;
6. adicione/valide o intent filter `autoVerify` apenas para os hosts realmente suportados.

Não confunda esse fingerprint com os quatro Secrets necessários para assinar a release: são objetivos diferentes.

## Distribuição sem Play Store

O workflow manual em modo `debug` gera:

```text
OrbiDoc-debug.apk
OrbiDoc-debug.apk.sha256
```

O APK pode ser baixado do artifact do GitHub Actions, enviado pelo Drive, USB ou página de downloads. Depois de instalado, o núcleo não depende do local de download.

Para distribuição direta contínua, prefira o APK **release** assinado com a mesma chave permanente em todas as versões.

## Release automática por tag

Uma tag como:

```text
android-v0.9.0
```

aciona o workflow release. A GitHub Release só publica APK/AAB quando a assinatura permanente está realmente configurada.

## Núcleo offline

O APK/AAB contém:
- HTML/CSS/JavaScript do workspace;
- Documentos, Planilhas, Apresentações e Design;
- PDF.js/reader;
- conversores locais;
- scanner;
- Tesseract worker/core WASM;
- OCR Português + Inglês;
- ícones e recursos do app.

No Capacitor:
- service worker PWA não é registrado;
- `index.html` é carregado do bundle local;
- OCR aponta para `native-ocr/` empacotado;
- exports usam MediaStore/`Downloads/OrbiDoc`;
- intents nativos permitem receber/abrir arquivos compatíveis.

## Recursos online opcionais

O app continua abrindo/editando localmente sem Internet. Internet é usada apenas quando o usuário escolhe recursos externos, por exemplo:
- IA em nuvem;
- **OrbiDoc Internet** para fatos recentes;
- Real-ESRGAN remoto;
- Firebase Authentication/sincronização;
- Google Drive/OneDrive;
- downloads por URL.

### OrbiDoc Internet

No APK BYOK, perguntas claramente atuais podem usar pesquisa nativa do provedor conectado:
- Gemini → Google Search grounding;
- Groq → Compound Web Search/Visit Website;
- OpenRouter → Web Search/Web Fetch, com fallback para o plugin web legado quando necessário.

Essa pesquisa necessita Internet e pode consumir a cota/preço da chave do provedor do usuário. O núcleo local não depende dela.

## Google Play — fluxo recomendado

1. manter `app.orbidoc.workspace` como package definitivo;
2. criar e guardar a keystore permanente;
3. configurar os quatro Secrets de assinatura;
4. executar `OrbiDoc Native Android` em modo `release`;
5. confirmar que o workflow gerou `OrbiDoc-release.aab` e que o APK passou `apksigner verify`;
6. criar o app na Play Console com o mesmo package;
7. enviar primeiro para teste interno/fechado conforme o requisito exibido na conta;
8. preencher Data Safety;
9. publicar política de privacidade e exclusão de conta quando houver conta em nuvem;
10. testar em aparelhos reais;
11. promover para produção.

A configuração de Android App Links é **opcional** e pode ser feita depois, sem bloquear esse fluxo.

## Conta e privacidade

O OrbiDoc possui conta local e conta Firebase em nuvem.

- Conta local: dados de identidade/hash ficam no dispositivo e não são sincronizados.
- Conta Firebase: quando Email/Password estiver habilitado, usa UID e pode sincronizar dados selecionados.

Se a versão publicada oferecer conta em nuvem:
- `/privacy.html` deve permanecer público;
- `/delete-account.html` deve permanecer público;
- exclusão dentro do app deve continuar disponível;
- `firestore.rules` deve ser publicado no Firebase real;
- Data Safety precisa corresponder ao comportamento real.

O Firebase atual ainda responde `PASSWORD_LOGIN_DISABLED`; isso é uma configuração administrativa externa, não uma exigência para o editor local ou para o AAB iniciar.

## Comandos de verificação

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run verify:pwa
bun run verify:playstore
bun run verify:native
bun run verify:mobile
bun run verify:auth
```

`verify:playstore` agora separa explicitamente:
- package/Capacitor/API 36/release workflow;
- assinatura criptográfica da release;
- Android App Links opcionais.

O CI falha se `capacitor.config.json` ganhar `server.url`, se o package divergir de `app.orbidoc.workspace`, se a release workflow perder `bundleRelease/apksigner`, ou se App Links forem habilitados sem fingerprint válido.

## Regra final

```text
                  OrbiDoc Core
                       │
        ┌──────────────┼──────────────┐
        │              │              │
      Web/PWA      Android APK    Android AAB
      opcional      instalável      Play Store
                     local
```

`assetlinks.json` pertence à camada opcional de links verificados; não à existência do app nativo.