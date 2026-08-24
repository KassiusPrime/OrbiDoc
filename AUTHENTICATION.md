# OrbiDoc Authentication

O OrbiDoc possui **duas formas de identidade**, sem tornar Google Drive ou Microsoft 365 obrigatórios:

1. **Conta OrbiDoc em nuvem (Firebase Authentication)** — e-mail/senha, UID, verificação de e-mail, recuperação e sincronização do workspace autenticado.
2. **Conta local OrbiDoc** — funciona offline no aparelho quando o Firebase não está disponível ou quando o usuário prefere não usar nuvem.

O produto permanece local-first: documentos continuam existindo no dispositivo e a conta local nunca finge ser uma sessão Firebase.

## Estado atual do Firebase

O projeto Firebase está acessível, porém o health-check real retorna atualmente:

```text
PASSWORD_LOGIN_DISABLED
```

Isso significa que **Email/Password está desativado administrativamente no projeto Firebase**. A API key pública do cliente não possui privilégio para alterar essa configuração.

O repositório já declara os provedores desejados em `firebase.json` e possui o workflow manual **OrbiDoc Firebase Production**. Depois que o Secret administrativo `FIREBASE_SERVICE_ACCOUNT_JSON` estiver configurado no GitHub, esse workflow:

1. autentica o Firebase CLI fora do frontend;
2. executa o deploy da configuração Authentication;
3. publica `firestore.rules` no banco Firestore nomeado realmente usado pelo OrbiDoc;
4. executa `verify:auth` com `ORBIDOC_REQUIRE_PASSWORD_AUTH=true`;
5. falha se Email/Password continuar desativado.

Também é possível habilitar o provedor manualmente no Firebase Console em **Authentication > Sign-in method > Email/Password**. Não é necessário reinstalar o APK após a ativação; o painel pode atualizar o status em tempo de execução.

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
- exclusão da identidade e dos dados associados na nuvem;
- namespace local separado por UID;
- adoção do workspace local no primeiro login daquele UID;
- merge local/nuvem pelo `updatedAt` mais recente;
- sincronização dos projetos autenticados com debounce.

Google Drive e OneDrive continuam conexões separadas e opcionais.

## Escopo local por conta

Projetos e histórico são guardados em escopos locais separados. Ao trocar de usuário, o OrbiDoc salva o escopo atual e restaura apenas o escopo associado ao novo UID.

No primeiro login em nuvem em um dispositivo, o workspace local existente pode ser adotado por aquela conta para evitar perda de trabalho. Em logins posteriores, o OrbiDoc restaura o namespace daquele UID em vez de misturar projetos de contas diferentes.

## Sincronização do workspace

Depois que uma conta Firebase real entra:

1. o OrbiDoc carrega os documentos remotos pertencentes ao UID;
2. mescla projetos remotos e locais pelo registro mais recente;
3. mantém projetos exclusivos do dispositivo;
4. inicializa o snapshot conhecido de IDs;
5. envia alterações posteriores com debounce;
6. só propaga exclusões depois que o snapshot inicial é conhecido, evitando apagar nuvem por causa de uma inicialização vazia.

Se uma gravação Firestore falhar, o projeto local é preservado; o app é local-first e não deve destruir trabalho por falha de sincronização.

## Configuração Firebase

O repositório contém `firebase-applet-config.json` e `.firebaserc`. Também é possível substituir a configuração pública do Web App através de variáveis:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_ID=
```

A instalação atual usa um banco Firestore nomeado. O `firebase.json` associa explicitamente `firestore.rules` a esse banco para evitar publicar regras apenas no banco `(default)` por engano.

## Segurança

A configuração Web do Firebase (`apiKey`, `projectId`, `appId`, `authDomain`) é pública por natureza. Ela não concede privilégio administrativo e não substitui regras de segurança.

Nunca coloque no frontend:
- JSON de Service Account;
- private keys;
- refresh tokens administrativos;
- segredos de servidor;
- credenciais privilegiadas de Google Cloud/Firebase Admin.

`FIREBASE_SERVICE_ACCOUNT_JSON` deve existir apenas como GitHub Actions Secret (ou ser substituído futuramente por Workload Identity Federation). O workflow de produção é manual e não expõe essa credencial ao bundle do OrbiDoc.

## Firestore atual

As regras usam UID como identidade principal e preservam compatibilidade controlada com registros legados por e-mail.

Coleções preparadas:
- `users/{uid}`
- `documents/{documentId}`
- `user_settings/{uid}`
- `chat_sessions/{sessionId}`

A **conta local não escreve nessas coleções**, pois não possui identidade Firebase e não deve fingir sincronização.

## Exclusão

### Conta local
Exige a senha local + a frase `EXCLUIR`. Remove a identidade/hash local, mas preserva os arquivos do workspace.

### Conta Firebase
Exige reautenticação + `EXCLUIR`, remove os registros associados na nuvem e exclui o usuário Firebase. Projetos apenas locais são preservados.

## Validação CI

`bun run verify:auth`:
- testa o endpoint real do Firebase Authentication sem criar usuário;
- verifica que `firebase.json` declara Email/Password;
- verifica que `firestore.rules` está associado ao banco nomeado usado pelo app;
- verifica estruturalmente o fallback local PBKDF2/SHA-256, salt aleatório e sessão persistente.

Em CI normal, `PASSWORD_LOGIN_DISABLED` gera warning explícito porque o fallback local continua válido. Em release/produção, `ORBIDOC_REQUIRE_PASSWORD_AUTH=true` transforma esse estado em erro fatal.

Assim, um CI verde de debug não pode mais ser confundido com autenticação de nuvem pronta para produção.
