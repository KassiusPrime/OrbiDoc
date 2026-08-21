# OrbiDoc Authentication

O OrbiDoc usa Firebase Authentication para oferecer uma conta própria por e-mail e senha sem tornar Google Drive ou Microsoft 365 obrigatórios.

## Objetivos

- login e cadastro com e-mail/senha;
- recuperação de senha;
- verificação de e-mail;
- sessão persistente no navegador/PWA;
- modo local continua funcionando sem conta;
- Google Drive e OneDrive permanecem conexões opcionais;
- identidade por `uid` preparada para preferências e sincronização seletiva futura.

## Custo

O Firebase possui o plano Spark, sem método de pagamento obrigatório para os produtos gratuitos. Authentication por e-mail/senha, social e anônimo está disponível dentro dos limites do plano. Consulte a documentação oficial antes de publicar para confirmar as cotas atuais.

## Opção A — usar o projeto Firebase já configurado

O repositório já contém `firebase-applet-config.json`. Para habilitar contas:

1. Abra o Firebase Console do projeto correspondente.
2. Acesse **Security > Authentication**.
3. Em **Sign-in method**, habilite **Email/Password**.
4. Opcionalmente habilite **Anonymous** para sessões temporárias.
5. Salve.
6. Em **Authentication > Settings**, revise os domínios autorizados e inclua o domínio de produção do OrbiDoc e os domínios de preview necessários.
7. Configure uma política de senha e habilite proteção contra enumeração de e-mails quando disponível.

O arquivo `firebase.json` deste repositório também declara `emailPassword` e `anonymous`. Em um ambiente autenticado com Firebase CLI, a configuração pode ser aplicada com:

```bash
firebase init auth
firebase deploy --only auth
```

Revise o projeto selecionado antes de executar qualquer deploy.

## Opção B — usar um projeto Firebase próprio

1. Crie um projeto Firebase no plano Spark.
2. Adicione um Web App.
3. Copie os valores do objeto de configuração.
4. Configure as variáveis abaixo no ambiente local ou na Vercel:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_ID=
```

`VITE_FIREBASE_DATABASE_ID` é opcional. Quando as variáveis estiverem vazias, o app usa `firebase-applet-config.json`.

## Importante sobre segurança

A configuração Web do Firebase (`apiKey`, `projectId`, `appId`, `authDomain`) é configuração pública do cliente. Ela não substitui regras de segurança.

Nunca coloque no frontend:

- chave JSON de Service Account;
- private keys;
- tokens administrativos;
- segredos de servidor;
- credenciais de API que permitam ações privilegiadas.

O acesso aos dados deve ser protegido por regras Firestore/Storage baseadas em `request.auth.uid`.

## Firestore atual

As regras do OrbiDoc usam `uid` como identidade principal e mantêm compatibilidade de leitura com documentos legados associados por e-mail.

Coleções preparadas:

- `users/{uid}`
- `documents/{documentId}`
- `user_settings/{uid}`
- `chat_sessions/{sessionId}`

## Estratégia recomendada de sincronização

Não sincronizar automaticamente todo o conteúdo do workspace em um único documento Firestore. Designs e apresentações podem conter imagens em Data URL e ultrapassar limites de documento.

Separar em camadas:

1. **Firestore:** metadados, preferências, favoritos, histórico leve, índices e estado de sincronização.
2. **Storage/Blob:** imagens, anexos, PDFs, thumbnails e arquivos pesados.
3. **Local-first:** edição continua no dispositivo mesmo offline.
4. **Sync seletivo:** cada projeto informa se está apenas local, sincronizado, pendente ou em conflito.
5. **Conflitos:** comparar `updatedAt` e oferecer manter local, manter nuvem ou duplicar ambos.

## Próximos passos de conta

- nome e avatar editáveis;
- painel de dispositivos/sessões;
- exclusão e exportação de conta;
- favoritos e templates por usuário;
- preferências sincronizadas;
- backup seletivo de projetos;
- recuperação de projeto excluído;
- histórico de versões;
- colaboração e compartilhamento por convite;
- App Check antes de abrir sincronização pública em escala.
