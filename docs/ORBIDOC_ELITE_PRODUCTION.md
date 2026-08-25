# OrbiDoc Elite — Produção, autenticação, Premium e publicação

Este guia descreve a arquitetura de produção do OrbiDoc sem atalhos inseguros. O objetivo é manter uma única identidade Firebase por usuário, uma única fonte de verdade para entitlements e fluxos de cobrança adequados para Web/PWA e Google Play.

## 1. Deixar o site realmente público na Vercel

O deployment de produção pode estar `READY` e ainda assim exigir Vercel Authentication/SSO. Antes do lançamento público:

1. Vercel → projeto **orbidoc** → Settings → Deployment Protection.
2. Desative **Vercel Authentication** para o ambiente Production, ou restrinja a proteção somente a previews.
3. Confirme em uma janela anônima que o domínio abre o OrbiDoc diretamente, sem redirecionar para `vercel.com/sso-api`.
4. Mantenha previews protegidos se quiser trabalhar em branches sem expor builds intermediários.

Pelo CLI da Vercel, o equivalente é conferir/trocar a proteção do projeto com `vercel project protection`.

## 2. Domínio próprio

Para produto comercial, use um domínio próprio como host canônico. A opção preferida de marca é `orbidoc.app` se ainda estiver disponível quando você registrar.

Depois de conectar o domínio na Vercel:

1. Defina o domínio como Production Domain.
2. Redirecione aliases antigos para o domínio canônico.
3. Firebase Console → Authentication → Settings → Authorized domains → adicione o hostname novo, sem `https://` e sem caminho.
4. Atualize links públicos, política de privacidade, exclusão de conta, e-mail e OAuth para usar o mesmo domínio.

## 3. Página profissional de verificação e recuperação

O OrbiDoc implementa um handler próprio em:

`/auth/action`

Ele trata os modos Firebase `verifyEmail`, `resetPassword` e `recoverEmail`, valida `oobCode` e rejeita `continueUrl` de origem externa.

Após a branch Elite estar publicada:

1. Firebase Console → Authentication → Templates.
2. Abra **Email address verification**.
3. Edite o template e configure a action URL para `https://SEU-DOMINIO/auth/action`.
4. Faça o mesmo para recuperação de senha e recuperação de e-mail quando o Console oferecer a action URL customizada.
5. Envie e-mails de teste e valide link expirado, link já usado, reset e verificação.

Enquanto não houver domínio próprio, use temporariamente o domínio público de produção da Vercel, desde que Deployment Protection esteja desligado para usuários finais.

## 4. Melhorar entrega do e-mail e reduzir Spam

Nenhum sistema pode garantir a aba Caixa de entrada. Para melhorar reputação e controle de marca, migre os e-mails transacionais para um domínio autenticado próprio.

Arquitetura recomendada:

1. Registrar/conectar o domínio do OrbiDoc.
2. Configurar um provedor transacional, por exemplo Resend, Postmark ou equivalente.
3. Publicar os registros DNS exigidos pelo provedor:
   - SPF
   - DKIM
   - DMARC
4. Usar um remetente consistente como `conta@orbidoc.app` ou `auth@orbidoc.app`.
5. No backend, usar Firebase Admin SDK para gerar links oficiais de verificação/reset.
6. Enviar esses links em templates próprios do OrbiDoc pelo provedor transacional.
7. Nunca enviar tokens ou credenciais de serviço para o cliente.
8. Monitorar bounce, complaint e taxa de entrega.

O template deve incluir logo OrbiDoc, assunto claro, nome do produto, motivo do e-mail, botão principal, URL de segurança alternativa e aviso de expiração/uso único.

## 5. Google Authentication

O login Google do OrbiDoc Web/PWA já usa Firebase `GoogleAuthProvider` e não pede escopo do Google Drive. Drive continua uma conexão opcional separada.

Para habilitar:

1. Firebase Console → Authentication → Sign-in method → Google.
2. Enable → escolha e-mail de suporte → Save.
3. Confirme que o domínio de produção está em Authorized domains.
4. Teste login, logout, conta existente e exclusão/reauth.
5. Para Android nativo, registre o app Android no Firebase e configure as impressões SHA exigidas antes de expor o botão nativo.

## 6. Microsoft Authentication

A branch Elite inclui a fundação Web/PWA via `OAuthProvider('microsoft.com')`, mas o botão só deve ser exposto depois da configuração administrativa.

Passos:

1. Microsoft Entra/Azure App Registration → crie um app para OrbiDoc.
2. Configure o redirect URI exigido pelo Firebase.
3. Gere Client Secret e copie Client ID + Client Secret.
4. Firebase Console → Authentication → Sign-in method → Microsoft.
5. Informe Client ID + Client Secret → Enable → Save.
6. Adicione o domínio de produção em Authorized domains.
7. Teste conta Microsoft pessoal e conta organizacional/Entra ID.
8. Configure fluxo nativo separado antes de liberar Microsoft no APK.

Nunca coloque o Microsoft Client Secret em código Vite, `VITE_*`, APK ou GitHub público.

## 7. Entitlements: Free, Premium e Supreme

A fonte de verdade é Firestore:

`entitlements/{firebaseUid}`

Planos:
- `free`
- `premium`
- `supreme`

Papéis:
- `user`
- `admin`
- `owner`

Usuários comuns podem ler o próprio entitlement, mas **não podem criar, editar ou se promover**. Escritas em `entitlements` são permitidas somente ao owner pelas regras do Firestore.

`Supreme` é um papel privado do proprietário e não deve aparecer como plano vendável ao público.

## 8. Criar o primeiro owner/Supreme

O primeiro owner é um bootstrap administrativo e deve ser criado manualmente pelo Firebase Console/Admin SDK, porque ainda não existe owner para conceder o primeiro owner.

1. Firebase Console → Authentication → Users.
2. Localize sua conta principal.
3. Copie o **UID** Firebase exato.
4. Firestore → banco usado pelo OrbiDoc → collection `entitlements`.
5. Crie document com ID igual ao UID.
6. Campos recomendados:

```text
email: "seu-email"
plan: "supreme"
role: "owner"
status: "active"
source: "firebase-console"
premiumUntil: null
features: ["*"]
updatedAt: "<ISO-8601 atual>"
```

7. Saia e entre novamente no OrbiDoc.
8. O botão **SUPREME** deve aparecer somente para esse owner.
9. Depois disso, use o Console Supreme para conceder/revogar outros entitlements.

Para evitar lockout, a UI não permite remover o próprio owner. Mudanças críticas do owner raiz continuam disponíveis pelo Firebase Console.

## 9. Premium e BYOK

Premium habilita `ai.byok`.

No Android:
- chaves de Gemini/Groq/OpenRouter ficam protegidas pelo Android Keystore;
- não são salvas no Firestore;
- não são colocadas no bundle;
- um usuário Free não recebe o formulário de configuração BYOK;
- Premium/Supreme recebe o formulário e a validação da chave.

Na Web, antes de oferecer BYOK, use armazenamento seguro compatível com navegador ou sessão e deixe claro que chaves do usuário não são cobradas pelo OrbiDoc como consumo próprio. Não sincronize API keys em texto puro.

## 10. Cobrança Web — Stripe

Arquitetura recomendada:

1. Criar conta Stripe da empresa/proprietário e concluir verificação de identidade/negócio.
2. Criar produto **OrbiDoc Premium**.
3. Criar preços mensal e anual.
4. Integrar Stripe Checkout no backend da Vercel.
5. Nunca criar Checkout Session usando secret key no cliente.
6. Validar assinatura do webhook Stripe.
7. Eventos de assinatura atualizam `entitlements/{uid}` no backend.
8. Mapear `stripeCustomerId`/`subscriptionId` em armazenamento administrativo, não em campos editáveis pelo cliente.
9. `checkout.session.completed`, `invoice.paid`, mudanças e cancelamentos devem manter o entitlement coerente.
10. Criar Billing Portal para o usuário administrar assinatura.

Segredos esperados no backend:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- chave publicável quando necessária no cliente

## 11. Cobrança Android — Google Play Billing

Para o app distribuído pela Google Play, recursos digitais/subscrições devem usar Google Play Billing quando a política exigir.

1. Play Console → Monetize → Products/Subscriptions.
2. Crie o produto Premium mensal/anual.
3. Integre Google Play Billing no shell Android.
4. Após compra, envie o purchase token ao backend.
5. Backend verifica o token com Google Play Developer API.
6. Somente depois da verificação, atualize `entitlements/{uid}` como Premium.
7. Use Real-time Developer Notifications para renovação, cancelamento, grace period e revogação.
8. Não confie em uma flag local do APK para liberar Premium.

Stripe Web e Play Billing Android convergem para a mesma collection `entitlements`.

## 12. Assinatura Android de produção

O CI gera APK debug. Para AAB/APK release permanente configure GitHub Actions Secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Depois:

1. Gere release assinado.
2. Verifique assinatura com `apksigner`.
3. Ative Play App Signing.
4. Faça Internal Testing antes de Closed/Open/Production.
5. Preencha Data Safety, política de privacidade e exclusão de conta.

## 13. Ícones e identidade visual

Para UI comercial, prefira uma biblioteca com licença permissiva e comportamento offline previsível.

- mantenha Tabler onde já está consistente;
- Material Symbols pode ser incorporado/self-hosted para ampliar o catálogo;
- evite hotlink em runtime para o APK/PWA;
- não copie ícones Flaticon gratuitos sem cumprir atribuição/licença;
- se usar Flaticon Premium, registre a licença e origem de cada asset no repositório/documentação interna.

Não misture três famílias de ícones na mesma superfície. Um app premium parece mais consistente quando cada categoria usa o mesmo peso óptico, grid e stroke.

## 14. Checklist de lançamento Elite

- [ ] Production sem Vercel SSO para público
- [ ] domínio próprio canônico
- [ ] Firebase Authorized Domains atualizado
- [ ] action URL `/auth/action` nos templates Firebase
- [ ] remetente transacional com SPF/DKIM/DMARC
- [ ] Google login habilitado/testado
- [ ] Microsoft login habilitado/testado
- [ ] primeiro owner/Supreme criado pelo UID
- [ ] Firestore rules Elite implantadas
- [ ] Stripe Web conectado + webhooks verificados
- [ ] Google Play Billing conectado + backend de verificação
- [ ] BYOK Premium validado
- [ ] Android release keystore configurada
- [ ] AAB Internal Testing aprovado
- [ ] Privacy / Terms / Data Safety / exclusão de conta
- [ ] observabilidade, erros e métricas de checkout
- [ ] testes de downgrade/cancelamento/refund
- [ ] teste completo em mobile, desktop, PWA e APK
