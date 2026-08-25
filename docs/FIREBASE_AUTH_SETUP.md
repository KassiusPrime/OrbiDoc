# OrbiDoc — habilitar Firebase Authentication em produção

Este projeto usa o Firebase **`gen-lang-client-0703075207`**. O cliente web já está configurado para esse projeto e `firebase.json` já declara:

```json
{
  "auth": {
    "providers": {
      "anonymous": true,
      "emailPassword": true
    }
  }
}
```

O erro `PASSWORD_LOGIN_DISABLED` significa que o backend Firebase está acessível, mas o provedor **Email/Password ainda está desativado administrativamente** no projeto. Alterar apenas o código do OrbiDoc não remove esse bloqueio.

## Caminho A — habilitação manual no Firebase Console

1. Abra o Firebase Console e selecione o projeto `gen-lang-client-0703075207`.
2. Vá para **Security → Authentication**.
3. Abra a guia **Sign-in method**.
4. Em **Native providers**, abra **Email/Password**.
5. Ative **Email/Password**.
6. Deixe **Email link (passwordless sign-in)** desligado, a menos que o produto passe a usar login por link.
7. Clique em **Save**.
8. Volte ao OrbiDoc, abra **Conta OrbiDoc → Nuvem** e pressione **Atualizar status**.
9. O estado esperado muda de `PASSWORD_LOGIN_DISABLED` para um erro normal de credencial inexistente (`INVALID_LOGIN_CREDENTIALS`, `EMAIL_NOT_FOUND` ou equivalente). Isso confirma que o provedor responde.

### Domínios autorizados

Em **Security → Authentication → Settings → Authorized domains**, confira o domínio permanente usado pelo OrbiDoc.

Para a configuração atual, use o hostname permanente configurado para produção, por exemplo:

- `orbidoc-cassianokaique9-3072s-projects.vercel.app`

Se você posteriormente conectar um domínio próprio, adicione também esse hostname. Não adicione esquemas (`https://`) nem caminhos.

`localhost` só deve ser adicionado quando você realmente precisar testar Authentication localmente. Projetos Firebase recentes não o incluem automaticamente, e ele não deve permanecer autorizado sem necessidade em produção.

## Caminho B — habilitação pelo GitHub Actions

O repositório possui o workflow **OrbiDoc Firebase Production**. Ele implanta a configuração de Authentication como código e valida que Email/Password realmente passou a responder.

### 1. Criar uma service account dedicada

No Google Cloud Console, abra o projeto `gen-lang-client-0703075207` e crie uma conta de serviço dedicada, por exemplo:

`orbidoc-firebase-deployer`

Evite reutilizar uma chave pessoal ou uma conta de serviço de outro sistema.

### 2. Conceder permissões

Para o fluxo atual:

- **Firebase Authentication Admin** — `roles/firebaseauth.admin`
- **Firebase Rules Admin** — `roles/firebaserules.admin` — somente porque o workflow também publica as regras do Firestore.

Se a conta for usada apenas para ativar Authentication, `roles/firebaseauth.admin` é a permissão principal necessária para modificar a configuração do Firebase Authentication.

### 3. Gerar a chave JSON

Na conta de serviço:

1. Abra **Keys**.
2. Escolha **Add key → Create new key**.
3. Selecione **JSON**.
4. Baixe o arquivo uma única vez e guarde-o com segurança.

Não faça commit desse JSON e não cole o conteúdo em `.env`.

### 4. Salvar no GitHub

No repositório GitHub:

1. Abra **Settings → Secrets and variables → Actions**.
2. Clique em **New repository secret**.
3. Nome: `FIREBASE_SERVICE_ACCOUNT_JSON`.
4. Valor: cole o conteúdo JSON completo da chave da conta de serviço.
5. Salve.

### 5. Executar o workflow

1. Abra **Actions**.
2. Selecione **OrbiDoc Firebase Production**.
3. Clique em **Run workflow** na branch de desenvolvimento atual.
4. O workflow executará, nessa ordem:
   - deploy da configuração `auth`;
   - verificação estrita de Email/Password;
   - deploy das regras do banco Firestore nomeado.
5. O job só termina verde se a autenticação por senha realmente estiver operacional.

## Política de senha recomendada

O OrbiDoc já exige no cliente pelo menos 8 caracteres. No Firebase Console, em **Security → Authentication → Settings → Password policy**, configure uma política compatível.

Configuração sugerida para o estado atual do produto:

- mínimo: **8 caracteres**;
- máximo: manter o padrão do Firebase;
- exigir letra minúscula: recomendado;
- exigir letra maiúscula: recomendado;
- exigir número: recomendado;
- caractere especial: opcional no primeiro rollout;
- modo: **Require** para contas novas quando a política estiver estabilizada.

O cliente OrbiDoc consulta a política Firebase no cadastro e informa os requisitos não atendidos. Assim, se a política ficar mais rígida depois, a interface não depende apenas de um número fixo de caracteres.

## Verificação local/CI

Depois de habilitar o provedor, execute:

```bash
bun run verify:auth
```

Para exigir que o comando falhe se Email/Password não estiver ativo:

```bash
ORBIDOC_REQUIRE_PASSWORD_AUTH=true bun run verify:auth
```

O health-check não cria uma conta real. Ele tenta autenticar um endereço inexistente e interpreta a resposta do Firebase:

- `PASSWORD_LOGIN_DISABLED` / `OPERATION_NOT_ALLOWED` → provedor ainda desativado;
- `INVALID_LOGIN_CREDENTIALS` / `EMAIL_NOT_FOUND` / `INVALID_PASSWORD` → provedor ativo e respondendo normalmente.

## Depois que ficar verde

Faça um teste funcional controlado:

1. crie uma conta OrbiDoc com um e-mail seu de teste;
2. confirme o recebimento do e-mail de verificação;
3. saia e entre novamente;
4. teste **Esqueci minha senha**;
5. crie ou altere um projeto e confirme sincronização no Firestore;
6. teste logout e nova autenticação em outro navegador/dispositivo;
7. exclua a conta de teste e confirme remoção dos dados de nuvem associados.

## Não fazer

- não tornar as regras do Firestore públicas para “resolver” autenticação;
- não colocar uma service-account key no frontend, APK ou Vercel client bundle;
- não versionar `FIREBASE_SERVICE_ACCOUNT_JSON`;
- não desativar a validação do CI para esconder `PASSWORD_LOGIN_DISABLED`;
- não usar uma conta local OrbiDoc como se fosse uma sessão Firebase — o fallback local é propositalmente separado.
