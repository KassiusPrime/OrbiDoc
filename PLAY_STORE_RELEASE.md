# OrbiDoc · checklist de publicação Android / Play Store

O OrbiDoc usa um único core web. A distribuição Android recomendada é uma Trusted Web Activity (TWA) empacotada como Android App Bundle (AAB).

## Estado que já existe no repositório

- PWA com `display: standalone` e `display_override`;
- service worker e cache offline;
- ícones PNG 192/512, maskable e Apple touch;
- manifesto validado no CI;
- `file_handlers` e `launch_handler` adicionados após o build;
- `/.well-known/assetlinks.json` gerado por `scripts/generate-assetlinks.mjs`;
- verificação estrutural em `scripts/verify-pwa-build.mjs`;
- perfil mobile com safe areas e navegação adaptativa;
- scanner com câmera traseira e leitor local;
- central de instalação por Android/iOS/desktop/web.

## O que não deve ir para o Git

Nunca commitar:

- keystore Android;
- senha da keystore;
- senha/alias da chave;
- chave de assinatura privada;
- credenciais de conta da Play Console.

## 1. Definir identidade Android estável

Recomendação:

```text
app.orbidoc.workspace
```

Depois que um pacote for publicado, não troque o package name.

## 2. Criar chave de upload/assinatura

Use Bubblewrap, Android Studio ou `keytool` fora do repositório. Guarde a chave em local seguro.

Ao usar Play App Signing, existem dois certificados relevantes:

- upload key: usada para enviar o AAB;
- app signing key: usada pela Google Play para assinar o app entregue aos usuários.

O Digital Asset Links de produção precisa incluir o SHA-256 que corresponde ao app efetivamente distribuído. Em testes locais, pode ser necessário incluir também o fingerprint da chave de upload/local.

## 3. Configurar ambiente de produção

Na Vercel, definir:

```text
VITE_PUBLIC_APP_URL=https://SEU-DOMINIO-ESTAVEL/
ANDROID_PACKAGE_NAME=app.orbidoc.workspace
ANDROID_SHA256_CERT_FINGERPRINT=AA:BB:CC:...
```

Depois da publicação, opcionalmente:

```text
VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=app.orbidoc.workspace
```

Não use URL de Preview da Vercel como domínio da TWA.

## 4. Fazer deploy e validar Digital Asset Links

Após o deploy, confirmar no navegador:

```text
https://SEU-DOMINIO-ESTAVEL/.well-known/assetlinks.json
```

O arquivo deve conter `delegate_permission/common.handle_all_urls`, o package name correto e o SHA-256 correto.

## 5. Gerar o AAB

Fluxo típico com Bubblewrap:

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://SEU-DOMINIO-ESTAVEL/manifest.webmanifest
bubblewrap build
```

Revise o `twa-manifest.json` gerado antes de construir a versão final.

Também é possível usar PWABuilder apontando para a URL pública configurada no OrbiDoc.

## 6. Testar antes da produção

Usar primeiro uma faixa de teste da Play Console:

1. internal testing;
2. closed testing, se necessário;
3. production somente após validar instalação, login, câmera, scanner, OCR, downloads, abertura de arquivos e modo offline.

## 7. Checklist funcional Android

- [ ] ícone normal correto;
- [ ] ícone maskable sem cortes;
- [ ] splash / inicialização com identidade OrbiDoc;
- [ ] botão de instalação não aparece quando o app já está instalado;
- [ ] câmera traseira abre no Scan & Reader;
- [ ] permissões são solicitadas apenas quando necessárias;
- [ ] PDF/EPUB/ZIP abrem no leitor;
- [ ] `Abrir com OrbiDoc` funciona quando a plataforma oferece File Handling API;
- [ ] conta OrbiDoc Email/Password funciona;
- [ ] modo local funciona sem conta;
- [ ] offline abre o shell do app sem página de erro do navegador;
- [ ] exportação/download funciona no Android alvo;
- [ ] Digital Asset Links está verificado;
- [ ] AAB está assinado com a chave correta;
- [ ] política de privacidade e dados da Play Store refletem o comportamento real do app.

## Limites externos

O código pode ficar pronto sem custo adicional, mas publicar na Google Play depende de uma conta de desenvolvedor Google Play e das exigências vigentes da Play Console. A chave privada de assinatura deve permanecer sob controle do proprietário do app e não deve ser criada/armazenada dentro do repositório.
