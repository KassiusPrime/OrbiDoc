# OrbiDoc Authentication

O OrbiDoc possui **duas formas de identidade**, sem tornar Google Drive ou Microsoft 365 obrigatórios:

1. **Conta OrbiDoc em nuvem (Firebase Authentication)** — e-mail/senha, UID, verificação de e-mail, recuperação e sincronização seletiva.
2. **Conta local OrbiDoc** — funciona offline no aparelho quando o Firebase não está disponível ou quando o usuário prefere não usar nuvem.

O workspace continua local-first nos dois casos. Entrar em uma conta nunca dispara upload automático de documentos.

## Estado atual do Firebase

O projeto Firebase está acessível, porém o health-check real retorna atualmente:

```text
PASSWORD_LOGIN_DISABLED
```

Isso significa que **Email/Password está desativado administrativamente no projeto Firebase**. O código do app não consegue habilitar esse provedor usando apenas a API key pública do cliente.

Para ativar a conta em nuvem:

1. Abra o Firebase Console do projeto correspondente.
2. Acesse **Authentication > Sign-in method**.
3. Habilite **Email/Password**.
4. Salve.
5. No OrbiDoc, abra **Conta e login > Nuvem > Atualizar status**.

Não é necessário reinstalar o APK depois dessa ativação.

## Conta local — fallback funcional

Quando a nuvem está indisponível, o usuário pode criar uma conta local diretamente no painel **Conta e login > Local**.

Propriedades:
- funciona offline;
- fica vinculada somente ao aparelho/perfil local do navegador;
- mantém a sessão até o usuário sair;
- não sincroniza automaticamente entre dispositivos;
- não grava a senha em texto simples;
- não envia a senha para Vercel/Firebase.

### Armazenamento da senha local

A implementação usa:

```text
PBKDF2
SHA-256
310.000 iterações
salt aleatório de 16 bytes
crypto.getRandomValues()
```

O armazenamento persistente contém somente metadados, salt e hash derivado. A senha original não é persistida.

A conta local é uma identidade **local**, não uma simulação de Firebase. A interface deixa isso explícito.

## Conta Firebase em nuvem

Quando Email/Password estiver ativo, o fluxo oferece:
- criação de conta;
- login com e-mail/senha;
- recuperação de senha;
- verificação de e-mail;
- sessão persistente com `browserLocalPersistence`;
- perfil/preferências associados a `request.auth.uid`;
- exclusão da identidade e dados associados na nuvem.

Google Drive e OneDrive continuam conexões separadas e opcionais.

## Configuração Firebase

O repositório contém `firebase-applet-config.json`. Também é possível substituir a configuração através das variáveis públicas do Web App:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_ID=
```

`VITE_FIREBASE_DATABASE_ID` é opcional. Quando as variáveis estão vazias, o app usa `firebase-applet-config.json`.

## Segurança

A configuração Web do Firebase (`apiKey`, `projectId`, `appId`, `authDomain`) é pública por natureza. Ela não concede privilégio administrativo e não substitui regras de segurança.

Nunca coloque no frontend:
- JSON de Service Account;
- private keys;
- refresh tokens administrativos;
- segredos de servidor;
- credenciais privilegiadas de Google Cloud/Firebase Admin.

Dados de nuvem devem ser protegidos por regras baseadas em `request.auth.uid`.

## Firestore atual

As regras do OrbiDoc usam UID como identidade principal e preservam compatibilidade de leitura/exclusão para registros legados por e-mail.

Coleções preparadas:
- `users/{uid}`
- `documents/{documentId}`
- `user_settings/{uid}`
- `chat_sessions/{sessionId}`

A **conta local não escreve nessas coleções**, pois não possui identidade Firebase e não deve fingir sincronização.

## Backup e sincronização

Conta e sincronização são conceitos separados.

Não sincronizar automaticamente todo o workspace em um único documento Firestore. Designs, apresentações e documentos podem conter imagens/Data URLs grandes.

Estratégia:
1. **Local-first:** criação/edição continua no dispositivo.
2. **Firestore:** metadados, preferências, índices e estados leves.
3. **Storage/Blob:** arquivos e anexos pesados, quando esse backend for implantado.
4. **Sync seletivo:** usuário escolhe quais projetos vão para nuvem.
5. **Conflitos:** comparar `updatedAt` e oferecer manter local, manter nuvem ou duplicar.
6. **Backup exportável:** continua disponível mesmo sem conta.

## Exclusão

### Conta local
Exige a senha local + a frase `EXCLUIR`. Remove a identidade/hash local, mas preserva os arquivos do workspace.

### Conta Firebase
Exige reautenticação + `EXCLUIR`, remove os registros associados na nuvem e exclui o usuário Firebase. Projetos apenas locais são preservados.

## Validação CI

`bun run verify:auth` faz duas coisas:
- testa o endpoint real do Firebase Authentication sem criar usuário;
- verifica estruturalmente que o fallback local usa PBKDF2/SHA-256, salt aleatório e sessão persistente.

Se o Firebase retornar `PASSWORD_LOGIN_DISABLED`, o CI registra o bloqueio externo, mas confirma que o login local continua funcional. `ORBIDOC_REQUIRE_PASSWORD_AUTH=true` pode ser usado em uma release que queira tratar o provedor Firebase desativado como erro fatal.
