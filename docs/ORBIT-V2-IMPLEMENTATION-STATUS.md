# Orbit V2 — Status de Implementação

Este documento acompanha a migração da especificação consolidada do Orbit sem confundir **fundação implementada**, **funcionalidade preservada** e **funcionalidade ainda planejada**.

## Hierarquia oficial

- **Orbit** — produto completo.
- **Orbispace** — workspace e contexto de trabalho.
- **OrbiDoc** — suíte de produtividade.
- **Nexus AI** — assistente único.

Módulos registrados em `src/orbit/modules.ts`:

| Módulo | Função | Prioridade | Estado desta migração |
| --- | --- | --- | --- |
| Orbit Nova | Documentos | P1 | Funcionalidade existente preservada; shell/design migration em andamento |
| Orbit Gravity | Planilhas | P1 | Funcionalidade existente preservada; shell/design migration em andamento |
| Orbit Aurora | Apresentações | P1 | Funcionalidade existente preservada; shell/design migration em andamento |
| Orbit Comet | Design | P1 | Funcionalidade existente preservada; shell/design migration em andamento |
| Orbit Nebula | PDF/OCR | P2 | Funcionalidade existente preservada; entrada/nomenclatura V2 aplicada |
| Orbit Satellite | Arquivos/Nuvem | P2 | Camadas de arquivos/cloud existentes; provider layer unificada ainda parcial |
| Orbit Horizon | Analytics | P2 | Dashboard atual preservado; builder avançado ainda pendente |
| Orbit Pulsar | Forms/Automação | P3 | Planejado |
| Orbit Meridian | Agenda | P3 | Planejado |

## P0 — Foundation

### Implementado neste branch

- `OrbitAppShell` como boundary de produto.
- Design tokens V2: spacing, radius, cores, dark mode, elevação e z-index.
- Breakpoints explícitos mobile, tablet, desktop e web-large.
- Safe-area + visualViewport/IME existentes preservados e novamente validados.
- Skip link para a área principal.
- Banner e live-region de estado offline.
- `prefers-reduced-motion`.
- `OrbitCommandPalette` com `Ctrl/Cmd+K`.
- busca/atalho rápido de arquivos com `Ctrl/Cmd+P`.
- primitives reutilizáveis: Workspace, Header, Toolbar, ToolbarGroup, FeatureBar, Panel, Card, StatusBadge, EmptyState e BottomSheet.
- registry central dos módulos Orbit.
- bottom navigation mobile: Início, Arquivos, Criar, Assistente, Apps.
- Create Sheet compacto com nomenclatura cósmica.
- Home do Orbispace convertida de superfície promocional para workspace.

### Ainda a migrar no P0

- substituir gradualmente layouts ad-hoc dos editores pelos primitives V2 sem reescrever engines funcionais;
- centralizar toda cópia/i18n atualmente hardcoded;
- consolidar sidebar/drawer atual como primitive dedicado e remover classes legadas restantes;
- testes visuais automatizados nas matrizes completas de viewport.

## P1 — Nexus AI e criadores principais

### Nexus AI — implementado

- assistente único, sem seletor de modelo/provider;
- OpenRouter como gateway remoto do Nexus;
- somente rotas gratuitas aprovadas;
- Vercel AI SDK + provider OpenRouter;
- `max_price=0`, fallback pago proibido e custo reportado validado;
- circuit breaker, retry/429 e cancelamento;
- Web search separada em modo zero-spend/fail-closed;
- UI compacta: contextual bar, feature bar, chips de ação e composer sticky;
- virtualização de conversa;
- continuidade para Orbit Nova;
- arquivo textual local como contexto;
- comportamento offline honesto: rascunho é preservado e nenhuma chamada remota é simulada;
- telemetria de runtime retirada da superfície do usuário e mantida como preocupação interna.

### Nova / Gravity / Aurora / Comet — preservado, migração incremental

As engines atuais continuam disponíveis para evitar regressões. O branch **não declara** TipTap+Yjs/PartyKit, Univer ou uma engine de slides/design totalmente nova como concluídos enquanto esses runtimes não forem implementados e validados com documentos reais.

Próximas etapas desses módulos:

1. migrar shell/toolbars/inspectors para primitives V2;
2. introduzir engines alvo atrás de adapters/feature flags quando necessário;
3. testar round-trip de DOCX/XLSX/PPTX;
4. introduzir CRDT sem quebrar autosave/local-first atual;
5. aplicar Nexus por diff/sugestão nas superfícies que alteram conteúdo.

## P2 — Arquivos, PDF e Analytics

### Contas e conectores — implementado/endurecido

- Conta Orbit separada de conexões externas.
- Google Drive usa scope mínimo `drive.file` no fluxo browser atual.
- Microsoft usa Authorization Code + PKCE S256.
- GitHub usa GitHub App, instalações/repositórios autorizados e troca de token server-side.
- troca OAuth GitHub existe tanto na Function quanto no servidor Express/self-hosted.
- callback GitHub validado, same-origin, `Cache-Control: no-store` e rate limit.
- tokens Google/Microsoft/GitHub não são persistidos em `localStorage`; migrações removem sessões legadas.
- `linkedAccounts` guarda/sincroniza somente metadados não secretos.
- escrita GitHub verifica permissão antes da operação.

### Limitação explícita

Google Drive usa o **token model moderno do Google Identity Services** para uma sessão browser-only. Ele não é o antigo implicit redirect, mas também não é ainda a futura sessão server-side por authorization code. Caso o Drive seja migrado para sessão durável no backend, a implementação deve usar authorization code, validação server-side e armazenamento seguro — nunca retornar a implicit flow legado.

### Ainda pendente em P2

- formalizar `OrbitFileProvider` para todos os providers e migrar as integrações existentes para esse adapter;
- branch de trabalho GitHub por padrão para alterações significativas;
- permissions sheet/provider picker compartilhados;
- preview universal e Open With unificados;
- Horizon dashboard builder avançado.

## P3 — Expansão

Ainda não declarado como implementado:

- Orbit Pulsar completo;
- Orbit Meridian completo;
- Notion import/export P2/P3;
- automações/webhooks completos;
- scheduling avançado;
- colaboração multiusuário completa por Orbispace/projeto;
- memória Nexus persistente por projeto com controles de privacidade.

## Validação automatizada

O CI do branch exige:

- lint;
- TypeScript;
- unit tests;
- build de produção;
- política Nexus free-only;
- PWA;
- Google Play/native readiness;
- Android APK debug;
- mobile/IME/safe-area audit;
- Firebase auth;
- security gate de Google/Microsoft/GitHub.

A auditoria de UI também falha se o Nexus voltar a expor seleção de modelo, se o shell/command palette/tokens forem removidos ou se a navegação mobile deixar de seguir a arquitetura oficial.

## Regra de migração

Nenhum recurso funcional deve ser removido apenas para produzir uma interface visualmente mais simples. Engines e fluxos existentes são substituídos somente quando a equivalência funcional estiver coberta por testes e, quando aplicável, por round-trip com arquivos reais.
