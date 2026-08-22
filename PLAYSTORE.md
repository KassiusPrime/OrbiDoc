# OrbiDoc — Android direto e Google Play

O OrbiDoc usa uma única base React/Vite, mas o Android **não depende mais de TWA como arquitetura principal**. A distribuição Android principal é um app Capacitor 8 que inclui o build `dist/` dentro do APK/AAB.

Isso significa que o OrbiDoc instalado consegue abrir e executar o núcleo local mesmo se a Vercel, o domínio ou qualquer backend estiver indisponível.

## Custo da Google Play

A conta de desenvolvedor Google Play exige uma taxa de registro única de **US$ 25**. Esse pagamento é da conta de publicação, não uma assinatura mensal do OrbiDoc.

A Play Store é opcional: o mesmo projeto também gera APK instalável diretamente.

## Identidade Android

- Nome: `OrbiDoc`
- Package atual: `app.orbidoc.workspace`
- Runtime: Capacitor 8
- Target SDK: Android 16 / API 36
- Web assets: `dist/` empacotado localmente
- `server.url`: **não configurado**

## 1. Distribuição sem Play Store

O workflow `.github/workflows/android-native.yml` pode ser executado manualmente em modo `debug`.

Ele gera:

```text
OrbiDoc-debug.apk
OrbiDoc-debug.apk.sha256
```

O APK pode ser:
- baixado do artifact do GitHub Actions;
- copiado por USB;
- enviado por Drive ou outro serviço de arquivos;
- colocado futuramente em uma página de downloads;
- instalado diretamente no Android quando o usuário autorizar instalação de apps dessa origem.

Depois de instalado, o núcleo do OrbiDoc não depende do lugar de onde o APK foi baixado.

### APK debug x APK release

O APK debug é ótimo para teste e uso pessoal, mas não deve ser a distribuição definitiva porque a identidade de assinatura precisa permanecer estável para atualizações.

Para distribuição contínua, gere o **APK release assinado** sempre com a mesma chave privada.

## 2. Chave permanente de assinatura

Crie uma chave Android uma única vez e guarde-a em local seguro. Nunca coloque o `.jks`, senhas ou conteúdo base64 no repositório.

O workflow espera estes GitHub Actions Secrets:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

A chave é reconstruída apenas no runner temporário durante o build e apagada junto com o ambiente do job.

Com esses Secrets configurados, execute o workflow em modo `release` para gerar:

```text
OrbiDoc-release.apk
OrbiDoc-release.aab
OrbiDoc-release.sha256
```

- `APK`: instalação direta.
- `AAB`: envio para Google Play.

## 3. Releases automáticas por tag

Uma tag no formato:

```text
android-v0.9.0
```

aciona o build release. Se a assinatura estiver configurada, o workflow cria uma GitHub Release contendo APK, AAB e checksums.

Use a mesma chave em todas as versões distribuídas diretamente. Trocar a chave impede atualização normal sobre uma instalação anterior assinada por outra identidade.

## 4. Núcleo offline

O APK/AAB contém:
- JavaScript/CSS/HTML do OrbiDoc;
- editores;
- leitor de documentos;
- PDF.js e worker;
- conversores locais;
- scanner;
- Tesseract worker/core WASM;
- dados OCR Português + Inglês;
- ícones e recursos do app.

Dentro do shell Capacitor:
- o service worker PWA não é registrado;
- o app não precisa buscar `index.html` na web;
- CTAs “Instalar OrbiDoc” ficam ocultos;
- OCR usa caminhos locais em `native-ocr/`.

## 5. Recursos que continuam online por natureza

O app continua abrindo e editando localmente sem esses serviços. Eles funcionam apenas quando houver Internet e configuração disponível:

- IA remota;
- Real-ESRGAN remoto;
- Firebase Authentication/sincronização;
- Google Drive/OneDrive;
- downloads a partir de URLs externas.

Nenhum desses recursos deve ser condição para inicializar o OrbiDoc.

## 6. Google Play — quando quiser publicar

A partir de **31 de agosto de 2026**, novos apps e atualizações móveis enviados ao Google Play precisam direcionar Android 16 / API 36 ou superior. Capacitor 8 usa target SDK 36 e o workflow também instala explicitamente Android SDK 36.

Fluxo recomendado:

1. criar/validar sua conta Google Play Developer;
2. pagar a taxa única de US$ 25, se ainda não tiver uma conta;
3. manter `app.orbidoc.workspace` como package definitivo;
4. criar/guardar a chave de assinatura;
5. configurar os quatro Secrets de assinatura no GitHub;
6. executar `OrbiDoc Native Android` em modo `release`;
7. baixar `OrbiDoc-release.aab`;
8. criar o app na Play Console com o mesmo package;
9. enviar primeiro para teste interno;
10. preencher Data Safety, política de privacidade e exclusão de conta;
11. testar em aparelhos reais;
12. promover para produção quando estiver satisfeito.

## 7. Conta, privacidade e exclusão

Se a versão publicada mantiver criação de conta:
- `/privacy.html` precisa permanecer público;
- `/delete-account.html` precisa permanecer público;
- a exclusão dentro do app deve continuar disponível;
- as regras `firestore.rules` precisam ser publicadas no Firebase real;
- a declaração Data Safety precisa corresponder ao comportamento da versão publicada.

Esses URLs são requisitos da distribuição/conta online, não requisitos para o editor local funcionar.

## 8. Testes de contas pessoais Google Play

Contas pessoais de desenvolvedor podem estar sujeitas aos requisitos de teste fechado do Google antes do acesso à produção. Verifique o requisito mostrado na sua própria Play Console, pois ele depende do tipo/data da conta.

## 9. Android Developer Verification fora da Play

O Google está implantando verificação de desenvolvedor também para distribuição fora da Play em dispositivos Android certificados.

Isso não transforma o OrbiDoc em um app dependente de servidor: é uma regra de identidade/distribuição do ecossistema Android. A instalação por APK continua sendo uma saída separada da Play Store, mas as exigências de verificação devem ser acompanhadas conforme o rollout de 2026–2027.

## 10. Comandos de verificação

No repositório:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run verify:pwa
bun run verify:playstore
bun run verify:native
```

O CI principal falha se `capacitor.config.json` ganhar um `server.url`, porque isso reintroduziria dependência de hospedagem para o shell nativo.

## Regra final

A web é uma forma de acesso ao OrbiDoc, não a origem obrigatória do app Android.

```text
                  OrbiDoc Core
                       │
        ┌──────────────┼──────────────┐
        │              │              │
      Web/PWA      Android APK    Android AAB
      opcional      instalável      Play Store
                     local
```

O APK e o AAB devem sempre carregar o workspace empacotado localmente.