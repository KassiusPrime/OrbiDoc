# OrbiDoc — PWA e Google Play

O OrbiDoc usa uma única base React/Vite para web, PWA mobile e PWA desktop. A distribuição Android pela Google Play deve empacotar a URL pública como **Trusted Web Activity (TWA)**, preservando a mesma aplicação e evitando um fork Android separado.

## Identidade Android recomendada

- Nome: `OrbiDoc`
- Package recomendado: `app.orbidoc.workspace`
- URL pública: configure `VITE_PUBLIC_APP_URL` com o domínio HTTPS estável de produção.
- Target SDK do pipeline OrbiDoc: **API 36 / Android 16**.

A partir de **31 de agosto de 2026**, novos apps e atualizações móveis enviados ao Google Play precisam direcionar Android 16 / API 36 ou superior. O pipeline OrbiDoc já usa 36 para evitar publicar um pacote prestes a ficar desatualizado.

O CI executa `bun run verify:playstore` depois do build. Se um projeto Android for adicionado ao repositório com `targetSdk` inferior a 36, a verificação falha.

## 1. Validar a PWA

Execute:

```bash
bun run build
bun run verify:pwa
bun run verify:playstore
```

A auditoria confirma manifesto, service worker, ícones 192/512, ícone maskable, file handlers, launch handler, política de privacidade, recurso público de exclusão de conta e `/.well-known/assetlinks.json`.

## 2. Preparar conta e exclusão de dados

Como o OrbiDoc permite criar conta por e-mail/senha dentro do app, a publicação precisa manter:

- exclusão de conta dentro da área de Conta OrbiDoc;
- página pública `https://<dominio>/delete-account.html`;
- remoção da identidade Firebase e dos dados associados atualmente mantidos pelo OrbiDoc na nuvem;
- política de privacidade pública em `https://<dominio>/privacy.html`;
- respostas da seção **Data Safety** coerentes com o comportamento real do app.

Na Play Console, informe a URL pública de `delete-account.html` no campo de exclusão de conta/dados. Não use uma URL de preview temporária.

### Firebase antes da publicação

O repositório contém as regras atualizadas em `firestore.rules`, mas publicar a aplicação na Vercel **não publica automaticamente as regras do Firestore**. Antes do teste de exclusão e do lançamento:

1. habilite Email/Password em Firebase Authentication;
2. adicione o domínio estável do OrbiDoc aos domínios autorizados do Authentication quando necessário;
3. publique `firestore.rules` no projeto Firebase usado em produção;
4. teste cadastro, login, recuperação de senha e exclusão completa com uma conta descartável.

## 3. Gerar o wrapper Android

Use PWABuilder ou Bubblewrap apontando para a URL **de produção**, nunca para um preview temporário da Vercel.

Configuração mínima:

- package name: `app.orbidoc.workspace`
- start URL: a URL pública do OrbiDoc
- display: standalone/TWA
- target SDK: **36 ou superior**
- App Bundle (`.aab`) para publicação

Depois de gerar o projeto, confirme no Gradle que `targetSdk`/`targetSdkVersion` é 36 ou superior. A ferramenta de empacotamento pode ter templates próprios; a auditoria do OrbiDoc não assume que o valor gerado está correto.

## 4. Assinatura e Digital Asset Links

A TWA só remove completamente a UI do navegador depois de verificar que o app Android e o domínio pertencem à mesma entidade.

Configure no ambiente de produção:

```env
ANDROID_PACKAGE_NAME=app.orbidoc.workspace
ANDROID_SHA256_CERT_FINGERPRINT=AA:BB:...:FF
ANDROID_TARGET_SDK=36
VITE_PUBLIC_APP_URL=https://SEU-DOMINIO-ESTAVEL/
```

O build gera `dist/.well-known/assetlinks.json` com esses dados.

Para uma distribuição pela Play Store com **Play App Signing**, use no site o SHA-256 do certificado que efetivamente assina o app distribuído pela Play. Não confunda esse certificado com uma chave temporária de desenvolvimento ou apenas com a upload key.

## 5. Primeiro envio à Play Console

Antes do upload final:

1. Crie o app na Play Console com o package definitivo.
2. Ative/registre a assinatura do app conforme o fluxo escolhido.
3. Obtenha o SHA-256 do certificado de distribuição.
4. Configure o fingerprint na Vercel e faça novo deploy do OrbiDoc.
5. Confirme que `https://<dominio>/.well-known/assetlinks.json` contém package + fingerprint corretos.
6. Confirme `https://<dominio>/privacy.html` e `https://<dominio>/delete-account.html` em janela anônima.
7. Gere novamente o AAB com `targetSdk 36+`.
8. Envie o bundle primeiro para **Teste interno**.
9. Teste câmera/scanner, perspectiva de quatro cantos, OCR, upload/abertura de arquivos, compartilhamento, file handlers, downloads, offline, autenticação, exclusão de conta e retorno de deep links no Android real.
10. Preencha a ficha da loja e Data Safety com base no comportamento efetivamente publicado.

## 6. Requisito de teste para contas pessoais novas

Se a conta pessoal de desenvolvedor Google Play foi criada **depois de 13 de novembro de 2023**, o Google exige um teste fechado antes de liberar acesso à produção. O requisito atual é:

- pelo menos **12 testadores**;
- participantes continuamente por **14 dias** no teste fechado;
- depois disso, solicitar acesso à produção e responder às perguntas de prontidão no Play Console.

Contas que não se enquadram nessa regra ainda devem usar teste interno/fechado por segurança, mas o bloqueio específico de 12 testadores por 14 dias depende do tipo e da data da conta.

## 7. Checklist de propriedade — precisa ser feito pelo responsável da publicação

Estes itens não devem ser inventados ou commitados automaticamente pelo código:

- [ ] escolher e confirmar o package definitivo (`app.orbidoc.workspace` é a recomendação atual);
- [ ] possuir uma conta Google Play Developer apta a publicar;
- [ ] definir um domínio HTTPS estável de produção;
- [ ] criar/guardar com segurança a chave de upload/assinatura conforme o fluxo da Play;
- [ ] obter o SHA-256 real do certificado de assinatura distribuído;
- [ ] configurar `ANDROID_PACKAGE_NAME`, `ANDROID_SHA256_CERT_FINGERPRINT`, `ANDROID_TARGET_SDK=36` e `VITE_PUBLIC_APP_URL` na Vercel;
- [ ] habilitar Email/Password no Firebase Authentication se ainda não estiver ativo;
- [ ] adicionar o domínio de produção aos domínios autorizados do Firebase Authentication quando necessário;
- [ ] publicar as regras atuais de `firestore.rules` no Firebase de produção;
- [ ] preencher Data Safety;
- [ ] informar a URL pública de exclusão de conta;
- [ ] preparar nome, descrição, screenshots, ícone e arte da ficha da loja;
- [ ] executar teste interno e, quando aplicável, teste fechado 12/14 dias;
- [ ] só então promover o AAB para produção.

## 8. Instalação sem Play Store

A Google Play não é necessária para usar o OrbiDoc como aplicativo. No Chrome Android, a PWA pode ser instalada diretamente e o navegador pode fornecer integração WebAPK. Essa instalação usa o mesmo manifesto, ícones e service worker, mas não depende de um AAB assinado pelo projeto.

## Estado do botão “Instalar”

O OrbiDoc detecta `display-mode: standalone`, o evento `appinstalled` e o retorno de um novo `beforeinstallprompt`. No mobile, CTAs de instalação são ocultados quando o app já está instalado; se o navegador voltar a considerar o site instalável após uma desinstalação, o estado é reavaliado.

## Versões desktop e iOS

- Windows/macOS/Linux: a distribuição desktop atual é PWA instalável. Um wrapper Tauri pode ser adicionado futuramente sem substituir o core web.
- iPhone/iPad: instalação pelo Safari → Compartilhar → Adicionar à Tela de Início.

## Estado validado desta rodada

O código funcional desta rodada foi validado no commit `fc3b4ba0fe7d7ce765efc8396f5be0bfaa0704df`: brand audit, lint, TypeScript, testes, build de produção, PWA/WebAPK/TWA e Google Play/API 36 passaram; a prévia Vercel correspondente ficou READY e `delete-account.html` foi verificado com a configuração Firebase injetada no build. O commit posterior de documentação `f627e74f95a376bde4769c0f96c09d1cf0c10a16` também passou integralmente no mesmo pipeline e ficou READY na Vercel.

Nunca mantenha três cópias independentes dos editores. O core de Documentos, Planilhas, Apresentações, Design, Scanner, Leitor e IA deve continuar compartilhado entre todos os shells.