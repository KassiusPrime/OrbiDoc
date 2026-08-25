# OrbiDoc Elite — auditoria de produto e direção de evolução

## Objetivo

Transformar o OrbiDoc de uma coleção forte de ferramentas em uma plataforma coerente, previsível, rápida e comercializável. O critério principal não é “ter mais botões”, e sim reduzir atrito, consolidar fluxos e tornar recursos avançados descobríveis sem poluir o workspace.

## P0 — lançamento seguro e identidade

1. Tornar o domínio de produção realmente público, removendo Vercel Authentication do Production e mantendo proteção em previews.
2. Adotar domínio próprio canônico.
3. Usar o domínio próprio nos e-mails Firebase, action links e OAuth.
4. Publicar `/auth/action` como handler visual OrbiDoc para verificação/reset/recover.
5. Validar Google login; preparar Microsoft e só mostrar quando o provider estiver ativo.
6. Criar owner/Supreme por UID, nunca por e-mail hard-coded.
7. Implantar regras Firestore Elite antes de liberar Console Supreme.
8. Configurar keystore Android release e AAB de Internal Testing.

## P0 — reduzir ruído visual

O `main.tsx` monta vários launchers globais. Isso é funcional, mas pode produzir excesso de botões flutuantes e competição por espaço, especialmente no mobile.

Direção:

- manter no máximo uma ação global primária contextual;
- mover utilitários, scanner, mídia, histórico, IA, resize e recursos avançados para um **Command Center / Apps Hub**;
- usar uma única Command Palette (`Ctrl/Cmd + K`) para pesquisar ações;
- permitir “fixar” 2–4 ferramentas favoritas no desktop/mobile;
- badges de estado devem ser informativos, não novos botões permanentes;
- Supreme só aparece para owner.

Remover ou consolidar:

- botões flutuantes redundantes que abrem superfícies já acessíveis pelo Apps Hub;
- cards que repetem a mesma explicação em onboarding, settings e editor;
- status técnicos persistentes que deveriam aparecer apenas em diagnóstico.

## P1 — navegação e shell

Criar uma hierarquia única:

- **Home**: recentes, favoritos, continuar trabalhando, quick create.
- **Arquivos**: workspace local + nuvem + filtros.
- **Criar**: Documento, Planilha, Apresentação, Design, Scan.
- **Apps**: conversores, OCR, mídia, utilitários, IA.
- **Conta**: identidade, plano, sincronização, conexões, segurança.
- **Configurações**: aparência, acessibilidade, atalhos, privacidade.

Desktop:
- sidebar recolhível;
- command palette;
- painéis laterais contextuais;
- breadcrumbs de documento/workspace.

Mobile:
- bottom navigation de 4–5 destinos no máximo;
- sheets em vez de modais pequenos;
- safe-area e teclado sempre respeitados;
- ações secundárias em overflow menu.

## P1 — onboarding progressivo

Não apresentar toda a suíte no primeiro acesso.

1. Escolher “continuar local” ou “entrar”.
2. Perguntar objetivo principal: documentos, estudo, trabalho, conversão, IA.
3. Mostrar 3 ações úteis, não 30 recursos.
4. Liberar dicas contextuais conforme o usuário usa novas superfícies.
5. Onboarding nunca bloqueia criação local.

## P1 — plano e monetização

Free deve permanecer útil e confiável.

Free:
- editores locais essenciais;
- leitura/conversão básica;
- OCR local básico;
- armazenamento local;
- conta e sincronização básica quando economicamente viável.

Premium:
- BYOK;
- recursos avançados de IA;
- templates Pro;
- exportações avançadas;
- histórico/sync ampliados;
- recursos de produtividade de alto valor.

Supreme:
- não vendido;
- papel owner/admin;
- entitlement `*`;
- console de feature flags/entitlements/auditoria.

Nunca esconder recursos críticos de segurança, exportação de dados ou exclusão de conta atrás do Premium.

## P1 — IA e BYOK

- BYOK somente Premium/Supreme.
- Android: Android Keystore.
- Web: não sincronizar chaves em texto puro; preferir sessão/armazenamento criptografado ou proxy opt-in.
- Mostrar custo pertencente ao provedor do usuário quando BYOK estiver ativo.
- Separar claramente “IA OrbiDoc inclusa” de “sua chave”.
- Provider escolhido deve ser respeitado; sem fallback silencioso entre provedores.
- Diagnóstico deve mostrar provider, modelo, pesquisa web, latência e erro sem expor segredo.

## P1 — sincronização confiável

Adicionar UI explícita para:
- Local only
- Sincronizando
- Sincronizado
- Offline
- Conflito
- Falha

Conflitos devem abrir comparação e permitir:
- manter local;
- manter nuvem;
- duplicar ambos;
- merge quando aplicável.

Nunca apagar uma versão local não sincronizada silenciosamente.

## P1 — performance

Os bundles de documentos, PDF, Firebase e ImageMagick são grandes. Prioridades:

- lazy-load por workspace;
- carregar PDF/XLSX/PPTX/Docx somente quando necessário;
- manter Magick WASM fora do caminho inicial;
- OCR somente sob demanda;
- separar painel admin/Premium em chunks;
- medir Core Web Vitals e tempo de abertura real em Android intermediário;
- limitar pre-cache da PWA a shell/essenciais, deixando engines pesadas para cache sob demanda quando possível.

Meta de percepção:
- shell interativo rapidamente;
- abrir editor comum sem esperar engines de conversão/OCR;
- feedback visual imediato para operações >200 ms.

## P1 — acessibilidade

- WCAG AA para texto/controles;
- foco visível consistente;
- labels em ícones;
- navegação completa por teclado;
- tamanho mínimo de toque mobile;
- `prefers-reduced-motion`;
- avisos de erro com `role=alert`;
- status assíncrono com `aria-live`;
- contraste de estados disabled sem depender apenas de cor.

## P1 — e-mail de autenticação

Curto prazo:
- domínio próprio no Firebase Authentication Templates;
- action URL OrbiDoc;
- From custom domain do Firebase;
- DNS solicitado pelo Firebase;
- assunto e copy claros;
- botão “Verificar e-mail”, sem URL crua como foco visual.

Longo prazo, se necessário:
- Firebase Admin gera links;
- provedor transacional envia template OrbiDoc;
- SPF/DKIM/DMARC;
- métricas de bounce/complaint;
- rate limits e anti-abuse.

## P1 — ícones

Princípio: consistência antes de variedade.

- manter Tabler como família principal enquanto cobre os casos;
- usar Material Symbols self-hosted somente para lacunas reais;
- não carregar ícones por CDN no APK/PWA offline;
- não usar Flaticon gratuito sem atribuição/licença adequada;
- evitar misturar filled/outline/3D em uma mesma navegação;
- criar uma camada `OrbiIcon` se um dia houver migração de biblioteca.

## P2 — recursos Elite de alto valor

### Documento
- tracked changes;
- comentários por intervalo persistentes;
- estilos/temas de documento;
- paginação/print layout mais fiel;
- compare versions;
- campos/TOC/footnotes refinados.

### Planilhas
- SUMIFS/COUNTIFS;
- PROCV/VLOOKUP + INDEX/MATCH;
- datas e horários;
- fórmulas relativas ao fill/copy;
- tabelas estruturadas;
- validação de dados visual;
- gráficos profissionais;
- pivô simplificado;
- import/export fidelity audit.

### Apresentações
- master layouts reais;
- agrupamento;
- alinhamento/distribuição;
- presenter view;
- speaker timer;
- export fidelity;
- reusable themes.

### Design Studio
- group/ungroup;
- layers panel real;
- blend/opacity;
- text effects;
- reusable brand kits;
- smart alignment;
- export presets social/print.

### Arquivos
- tags/favoritos;
- busca full-text local;
- duplicados;
- recent/frequent;
- storage inspector;
- recovery bin local.

## P2 — confiança e observabilidade

- tela de status do serviço;
- IDs de erro copiáveis;
- crash reporting com privacidade;
- telemetria opt-in/minimizada;
- audit log de ações admin;
- alertas de pagamento/webhook;
- métricas de sync sem conteúdo do documento;
- backup e restauração testados.

## P2 — conta e privacidade

- painel “Seus dados”;
- sessões/dispositivos quando suportado;
- exportar dados da conta;
- apagar conta;
- revoke provider connections;
- Drive/OneDrive sempre separados da autenticação;
- política de retenção clara.

## P2 — publicação e crescimento

- landing page pública separada do workspace autenticado;
- páginas Features, Pricing, Security, Privacy, Terms, Download;
- changelog;
- documentação rápida;
- páginas SEO para ferramentas gratuitas selecionadas sem expor workspace privado;
- referral somente depois de billing e anti-fraud estáveis.

## Critério “app de elite”

O OrbiDoc chega a um patamar premium quando:

1. o usuário entende onde está e o que fazer em segundos;
2. o shell é leve, enquanto engines pesadas carregam sob demanda;
3. login, sync e cobrança nunca mentem sobre o estado;
4. Free é útil; Premium entrega valor claro; Supreme é seguro;
5. desktop e mobile têm hierarquia própria, não apenas a mesma UI encolhida;
6. cada superfície tem uma ação principal clara;
7. erros são diagnosticáveis;
8. dados e chaves nunca ficam menos seguros para simplificar a interface;
9. atualizações preservam arquivos e compatibilidade;
10. o produto parece uma plataforma única, não uma soma de ferramentas.
