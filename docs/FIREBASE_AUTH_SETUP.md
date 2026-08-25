# OrbiDoc — Firebase Authentication em produção

Este projeto usa o Firebase **`gen-lang-client-0703075207`**. O cliente web já está conectado a esse projeto e o login **Email/Password está ativo** quando `bun run verify:auth` retorna um erro normal de credencial inexistente (`INVALID_LOGIN_CREDENTIALS`, `EMAIL_NOT_FOUND` ou equivalente), em vez de `PASSWORD_LOGIN_DISABLED`.

O OrbiDoc oferece três caminhos de identidade separados:

- **Google → Firebase Authentication**: conta OrbiDoc em nuvem;
- **Email/Password → Firebase Authentication**: conta OrbiDoc em nuvem;
- **Conta local**: PBKDF2/SHA-256 no dispositivo, sem Firebase e sem sincronização entre aparelhos.

A conexão com **Google Drive** continua sendo uma autorização separada. Entrar no OrbiDoc com Google não concede acesso automático ao Drive.

## Email/Password

### Habilitação manual

1. Abra o Firebase Console e selecione `gen-lang-client-0703075207`.
2. Vá para **Security → Authentication**.
3. Abra **Sign-in method**.
4. Em **Native providers**, abra **Email/Password**.
5. Ative **Email/Password** e clique em **Save**.
6. Deixe **Email link (passwordless sign-in)** desligado enquanto o produto não usar login por link.
7. No OrbiDoc, abra **Conta OrbiDoc → Nuvem → Atualizar status**.

O estado saudável é uma resposta como `INVALID_LOGIN_CREDENTIALS`: significa que o provedor está ativo e recusou corretamente a conta fictícia usada pelo health-check.

## Login com Google — sem acesso automático ao Drive

O código do OrbiDoc usa `GoogleAuthProvider` + `signInWithPopup()` do Firebase Web SDK. Esse login solicita apenas a identidade Google necessária ao Firebase; o serviço `googleAuthDrive.ts`, que pede `drive.file`, permanece independente.

Para habilitar o provedor:

1. Firebase Console → projeto `gen-lang-client-0703075207`.
2. **Security → Authentication → Sign-in method**.
3. Abra **Google**.
4. Ative **Enable**.
5. Defina o nome público do projeto como **OrbiDoc**.
6. Selecione um **Project support email** que você controle.
7. Clique em **Save**.

Não coloque o endereço de suporte pessoal dentro do código-fonte. O Firebase mantém esse valor na configuração administrativa do projeto.

### Web/PWA

A implementação Web/PWA usa popup Firebase. Os hostnames reais do aplicativo precisam constar em **Security → Authentication → Settings → Authorized domains**.

Use atualmente:

- `orbidoc-cassianokaique9-3072s-projects.vercel.app`
- `orbidoc-git-main-cassianokaique9-3072s-projects.vercel.app`

Não adicione `https://`, caminhos, nem o endereço do painel `vercel.com/...`.

Se um domínio próprio for conectado depois, adicione também esse hostname.

### Android nativo

O APK Capacitor não deve fingir que um popup web equivale ao Google Sign-In nativo. Para habilitar Google no APK de produção ainda é necessário:

1. registrar o aplicativo Android `app.orbidoc.workspace` no mesmo projeto Firebase;
2. registrar as impressões **SHA-1** e, preferencialmente, **SHA-256** da chave usada para assinar o app;
3. baixar/configurar `google-services.json` para esse aplicativo Android;
4. integrar/validar o fluxo Google nativo;
5. repetir o teste com a keystore de release, não apenas a debug.

Enquanto essa etapa não estiver concluída, o OrbiDoc informa explicitamente que Google Sign-In está disponível na Web/PWA e mantém e-mail/senha funcionando no APK.

## Domínios autorizados

Em **Security → Authentication → Settings → Authorized domains**, mantenha apenas hosts necessários ao produto.

Produção atual:

- `orbidoc-cassianokaique9-3072s-projects.vercel.app`

Branch principal/preview estável:

- `orbidoc-git-main-cassianokaique9-3072s-projects.vercel.app`

`localhost` só deve ser autorizado quando testes locais de Authentication realmente forem necessários.

## E-mail de verificação não chegou

O OrbiDoc usa `sendEmailVerification()` do Firebase e agora **não ignora falhas de envio**. Se o Firebase rejeitar o envio, a interface mostra o erro e mantém o botão **Reenviar**.

Se a chamada for aceita mas a mensagem não aparecer:

1. confirme que a conta foi criada em **Security → Authentication → Users**;
2. confira se o endereço digitado está correto;
3. abra **Spam**, **Todos os e-mails** e filtros/regras da caixa de entrada;
4. no OrbiDoc, abra a conta e pressione **Reenviar** uma vez;
5. evite clicar repetidamente para não atingir proteção contra abuso/cota;
6. em **Security → Authentication → Templates**, confira o template **Email address verification**;
7. confirme que o template está habilitado e que remetente/nome do projeto fazem sentido;
8. teste também **Esqueci minha senha** para separar um problema geral de entrega de e-mail de um problema específico do template de verificação.

Erros tratados explicitamente pelo app incluem:

- `auth/too-many-requests`;
- `auth/quota-exceeded`;
- `auth/unauthorized-domain`;
- `auth/unauthorized-continue-uri`;
- `auth/internal-error`.

O Firebase pode aceitar a requisição de envio sem fornecer ao cliente uma confirmação de entrega na caixa postal. Por isso, o teste funcional final continua sendo conferir a mensagem no destinatário.

## Habilitação administrativa pelo GitHub Actions

O repositório possui o workflow **OrbiDoc Firebase Production** para implantar a configuração de Authentication e regras do Firestore.

### 1. Criar uma service account dedicada

No Google Cloud Console do projeto `gen-lang-client-0703075207`, crie uma conta de serviço dedicada, por exemplo:

`orbidoc-firebase-deployer`

### 2. Conceder permissões

- **Firebase Authentication Admin** — `roles/firebaseauth.admin`
- **Firebase Rules Admin** — `roles/firebaserules.admin`

A segunda função só é necessária porque o workflow também publica as regras do Firestore.

### 3. Gerar e guardar a chave JSON

1. **Keys → Add key → Create new key → JSON**.
2. Guarde o arquivo com segurança.
3. Nunca faça commit do JSON e nunca o exponha no frontend/APK.

### 4. Salvar no GitHub

Repositório → **Settings → Secrets and variables → Actions → New repository secret**:

- Nome: `FIREBASE_SERVICE_ACCOUNT_JSON`
- Valor: JSON completo da conta de serviço.

### 5. Executar o workflow

**Actions → OrbiDoc Firebase Production → Run workflow**.

A ordem é:

1. deploy da configuração `auth`;
2. health-check estrito de Email/Password;
3. deploy das regras do banco Firestore nomeado.

## Política de senha recomendada

Em **Security → Authentication → Settings → Password policy**:

- mínimo: **8 caracteres**;
- minúscula: recomendado;
- maiúscula: recomendado;
- número: recomendado;
- caractere especial: opcional no primeiro rollout;
- modo: **Require** quando a política estiver estabilizada.

O OrbiDoc consulta a política Firebase com `validatePassword()` antes da criação da conta.

## Verificação local/CI

```bash
bun run verify:auth
```

Modo estrito:

```bash
ORBIDOC_REQUIRE_PASSWORD_AUTH=true bun run verify:auth
```

Interpretação:

- `PASSWORD_LOGIN_DISABLED` / `OPERATION_NOT_ALLOWED` → Email/Password desativado;
- `INVALID_LOGIN_CREDENTIALS` / `EMAIL_NOT_FOUND` / `INVALID_PASSWORD` → Email/Password ativo.

## Teste funcional final

1. crie uma conta OrbiDoc por e-mail;
2. confirme o recebimento/verificação;
3. saia e entre novamente;
4. teste **Esqueci minha senha**;
5. habilite Google no Firebase e teste **Continuar com Google** na Web/PWA;
6. confirme que entrar com Google não pede permissão de Drive;
7. conecte Google Drive separadamente apenas se quiser e confirme que esse consentimento é distinto;
8. altere um projeto e confirme sincronização no Firestore;
9. teste logout e nova autenticação em outro navegador;
10. teste exclusão de conta, inclusive reautenticação Google para contas Google-only.

## Não fazer

- não tornar regras do Firestore públicas para contornar autenticação;
- não colocar service-account key no frontend, APK ou bundle Vercel;
- não versionar `FIREBASE_SERVICE_ACCOUNT_JSON`;
- não usar o OAuth de Google Drive como se fosse automaticamente o login Firebase;
- não pedir escopo `drive.file` apenas para autenticar a conta OrbiDoc;
- não cadastrar `vercel.com/<time>/<project>` como Authorized domain; esse endereço é painel administrativo, não o app;
- não tratar conta local como sessão Firebase.
