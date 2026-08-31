# OrbiDoc — contas externas e projetos privados

Este documento descreve a configuração de menor custo para vincular uma Conta OrbiDoc a Google Drive, Microsoft/OneDrive e GitHub sem armazenar tokens de terceiros no Firestore.

## Arquitetura

- **Conta OrbiDoc:** Firebase Authentication + Firestore no plano Spark enquanto o uso couber nas cotas gratuitas.
- **Google Drive:** Google Identity Services + Drive API v3, com consentimento separado do login OrbiDoc.
- **Microsoft/OneDrive:** Microsoft Entra App Registration + OAuth Authorization Code com PKCE + Microsoft Graph.
- **GitHub:** GitHub App. O proprietário escolhe `All repositories` ou `Only select repositories`; o OrbiDoc não pede um PAT amplo.
- **Vínculo:** `users/{uid}.linkedAccounts` guarda somente IDs, e-mail/nome e escopos descritivos. Access tokens e refresh tokens não são enviados ao Firestore.

## 1. Google e Google Drive

### Firebase Authentication

1. Crie/use o projeto Firebase do OrbiDoc.
2. Em Authentication > Sign-in method, habilite **Google**.
3. Em Authentication > Settings > Authorized domains, inclua o domínio de produção do OrbiDoc.
4. O login Firebase autentica a Conta OrbiDoc; ele não concede acesso ao Drive automaticamente.

### Google Drive OAuth

1. No mesmo Google Cloud Project (ou em um projeto separado), habilite **Google Drive API**.
2. Configure a tela de consentimento OAuth.
3. Crie um OAuth Client do tipo **Web application**.
4. Em **Authorized JavaScript origins**, cadastre cada origem exata usada pelo app, por exemplo:
   - `https://SEU-DOMINIO`
   - `https://SEU-PROJETO.vercel.app`
   - `http://localhost:3000` para desenvolvimento
5. Não coloque caminhos como `/auth/...` em Authorized JavaScript origins. Origem é somente protocolo + host + porta.
6. Defina o Client ID em `VITE_GOOGLE_CLIENT_ID`.

O conector Drive atual solicita `userinfo.profile`, `userinfo.email` e `drive.file`. `drive.file` reduz o alcance aos arquivos criados/abertos com autorização para o OrbiDoc, em vez de solicitar acesso geral ao Drive.

### `origin_mismatch`

Se o Google retornar `origin_mismatch`, compare literalmente a origem mostrada no navegador com a cadastrada no Google Cloud. `http`/`https`, subdomínio, host e porta precisam coincidir.

## 2. Microsoft / OneDrive

1. Abra Microsoft Entra > App registrations > New registration.
2. Para aceitar contas pessoais Microsoft e contas corporativas/escolares, use a opção de contas compatível com `common`.
3. Em Authentication, adicione uma plataforma **Single-page application (SPA)**.
4. Cadastre exatamente:
   - `https://SEU-DOMINIO/auth/microsoft`
   - a URL equivalente de desenvolvimento se necessário.
5. Em API permissions, use permissões delegadas:
   - `User.Read`
   - `Files.ReadWrite`
   - OpenID Connect usa também `openid`, `profile` e `email` no pedido do cliente.
6. Copie o Application (client) ID para `VITE_MICROSOFT_CLIENT_ID`.

O OrbiDoc usa Authorization Code + PKCE e não precisa de client secret no navegador. Para contas corporativas, políticas do administrador do tenant ainda podem exigir aprovação.

## 3. GitHub privado

Crie um **GitHub App**, não um OAuth App com escopo `repo` amplo.

Configuração mínima recomendada:

- Homepage URL: URL pública do OrbiDoc.
- Callback URL: `https://SEU-DOMINIO/auth/github`.
- Repository permissions:
  - **Contents: Read and write** — necessário para ler/editar arquivos e usar Git via token.
  - **Metadata: Read** — acesso básico aos repositórios instalados.
- Organization permissions: nenhuma, salvo necessidade futura explícita.
- Webhooks: não são necessários para o workspace atual.

Na instalação, o GitHub mostra as permissões e permite ao proprietário selecionar todos os repositórios ou somente projetos específicos.

Variáveis:

```env
VITE_GITHUB_CLIENT_ID=
VITE_GITHUB_APP_SLUG=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

`GITHUB_CLIENT_SECRET` é segredo de servidor e deve ficar apenas no ambiente de implantação. Nunca use prefixo `VITE_` para ele.

Depois de conectado, **Conta e conexões > GitHub Projects** abre o workspace de repositórios. Ele permite:

- listar apenas repositórios concedidos à instalação;
- visualizar a árvore do projeto;
- abrir e editar arquivos de texto de até 2 MB quando o usuário tem escrita;
- salvar alterações pelo Contents API;
- baixar o repositório completo em ZIP;
- abrir a página original no GitHub;
- alterar a seleção de repositórios pela tela de instalação do GitHub App.

## 4. Modelo de vínculo

O mesmo UID OrbiDoc pode ter, simultaneamente:

```text
Conta OrbiDoc (Firebase UID)
├── Google Drive (account id + email)
├── Microsoft / OneDrive (account id + email)
└── GitHub (user id + login)
```

O vínculo serve para continuidade de identidade e interface. Cada provedor continua exigindo seu próprio consentimento e token, e desconectar um serviço não exclui a Conta OrbiDoc nem os arquivos locais.

## 5. Segurança

- Tokens externos ficam em `sessionStorage` quando o fluxo atual usa token no browser.
- Firestore recebe apenas metadados não secretos do vínculo.
- GitHub App aplica o princípio do menor privilégio e seleção de repositórios.
- Microsoft usa PKCE.
- Nunca salve client secrets, chaves privadas de GitHub App ou service-account JSON no bundle Vite.
- Para produção, use HTTPS e um domínio estável; revise também `privacy.html` e a tela de consentimento dos provedores.
