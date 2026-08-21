# OrbiDoc — PWA e Google Play

O OrbiDoc usa uma única base React/Vite para web, PWA mobile e PWA desktop. A distribuição Android pela Google Play deve empacotar a URL pública como **Trusted Web Activity (TWA)**, preservando a mesma aplicação e evitando um fork Android separado.

## Identidade Android recomendada

- Nome: `OrbiDoc`
- Package: `app.orbidoc.workspace`
- URL pública: configure `VITE_PUBLIC_APP_URL` com o domínio HTTPS estável de produção.
- Target SDK mínimo do pipeline OrbiDoc: **API 36 / Android 16**.

O CI executa `bun run verify:playstore` depois do build. Se um projeto Android for adicionado ao repositório com `targetSdk` inferior a 36, a verificação falha.

## 1. Validar a PWA

Execute:

```bash
bun run build
bun run verify:pwa
bun run verify:playstore
```

A auditoria confirma manifesto, service worker, ícones 192/512, ícone maskable, file handlers, launch handler e `/.well-known/assetlinks.json`.

## 2. Gerar o wrapper Android

Use PWABuilder ou Bubblewrap apontando para a URL **de produção**, nunca para um preview temporário da Vercel.

Configuração mínima:

- package name: `app.orbidoc.workspace`
- start URL: a URL pública do OrbiDoc
- display: standalone/TWA
- target SDK: **36 ou superior**
- App Bundle (`.aab`) para publicação

Depois de gerar o projeto, confirme no Gradle que `targetSdk`/`targetSdkVersion` é 36 ou superior. A ferramenta de empacotamento pode ter templates próprios; a auditoria do OrbiDoc não assume que o valor gerado está correto.

## 3. Assinatura e Digital Asset Links

A TWA só remove completamente a UI do navegador depois de verificar que o app Android e o domínio pertencem à mesma entidade.

Configure no ambiente de produção:

```env
ANDROID_PACKAGE_NAME=app.orbidoc.workspace
ANDROID_SHA256_CERT_FINGERPRINT=AA:BB:...:FF
ANDROID_TARGET_SDK=36
```

O build gera `dist/.well-known/assetlinks.json` com esses dados.

Para uma distribuição pela Play Store com **Play App Signing**, use no site o SHA-256 do certificado que efetivamente assina o app distribuído pela Play. Não confunda esse certificado com uma chave temporária de desenvolvimento.

## 4. Primeiro envio à Play Console

Antes do upload final:

1. Crie o app na Play Console com o package definitivo.
2. Ative/registre a assinatura do app conforme o fluxo escolhido.
3. Obtenha o SHA-256 do certificado de distribuição.
4. Configure o fingerprint na Vercel e faça novo deploy do OrbiDoc.
5. Confirme que `https://<dominio>/.well-known/assetlinks.json` contém package + fingerprint corretos.
6. Gere novamente o AAB com `targetSdk 36+`.
7. Envie o bundle para uma faixa de teste interno antes de produção.
8. Teste câmera/scanner, upload de arquivos, compartilhamento, file handlers, downloads, offline, autenticação e retorno de deep links no Android real.

## 5. Instalação sem Play Store

A Google Play não é necessária para usar o OrbiDoc como aplicativo. No Chrome Android, a PWA pode ser instalada diretamente e o navegador pode fornecer integração WebAPK. Essa instalação usa o mesmo manifesto, ícones e service worker, mas não depende de um AAB assinado pelo projeto.

## Estado do botão “Instalar”

O OrbiDoc detecta `display-mode: standalone`, o evento `appinstalled` e o retorno de um novo `beforeinstallprompt`. No mobile, CTAs de instalação são ocultados quando o app já está instalado; se o navegador voltar a considerar o site instalável após uma desinstalação, o estado é reavaliado.

## Versões desktop e iOS

- Windows/macOS/Linux: a distribuição desktop atual é PWA instalável. Um wrapper Tauri pode ser adicionado futuramente sem substituir o core web.
- iPhone/iPad: instalação pelo Safari → Compartilhar → Adicionar à Tela de Início.

Nunca mantenha três cópias independentes dos editores. O core de Documentos, Planilhas, Apresentações, Design, Scanner, Leitor e IA deve continuar compartilhado entre todos os shells.
