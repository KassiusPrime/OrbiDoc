# OrbiDoc — Relatório de entrega (Comando Mestre, Fases 0–6)

**Data:** 2026-09-12 · **Branch:** `arena/01a0618a-orbidoc` · **PR:** [#19](https://github.com/KassiusPrime/OrbiDoc/pull/19)
**Instrução preservada:** a logo **não foi alterada** (`OrbiDocLogo.tsx`, `public/brand/*`,
ícones PWA e `BRAND.md` intocados).

---

## Fase 0 — Inventário

### Arquivos
- `AUDIT-FASE-0.md` — novo. Cadeia de shells, 12 superfícies, violações V1–V6, mapa de
  conectores e decisões de escopo.

### Checklist
- [x] Entrypoints, shells e routers mapeados
- [x] Todas as surfaces listadas com contagem de barras permanentes
- [x] `SavedProject` → `WorkObject` mapeado
- [x] UI de GitHub/Drive localizada
- [x] Nenhuma feature editada nesta fase

### Anti-Frankenstein
**Não passava** na linha de base: 3 faixas permanentes na planilha, título em dois lugares,
GitHub como modal. Registrado — é o que as fases seguintes corrigem.

---

## Fase 1 — Shell único e contrato

### Arquivos
- `src/lib/workObjects.ts` — novo: `WorkObject`, `WorkObjectKind`, `workObjectFromProject`,
  `KIND_LABEL`, `SOURCE_LABEL` (adaptador, sem migrar `localStorage`).
- `src/AppV5.tsx` — `surfaceOwnsTitle`/`shellTitle`: fim do título duplicado.

### Checklist
- [x] Cadeia de layout documentada (`OrbitAppShell → OrbiDocExperienceShell → AppV5`)
- [x] Surface preenche a altura sem double scroll (`data-orbit-surface="editor"`)
- [x] Não há segundo app frame entre rotas principais
- [x] Título do objeto aparece **uma** vez

---

## Fase 2 — Tokens

### Arquivos
- `src/orbit-tokens.css` — novo: camada semântica (ação, IA, sucesso, danger, canvas,
  espaço escala 4, radius, elevação, z-index, dimensões de chrome).
- `docs/ORBIT-TOKENS.md` — novo: referência escrita única.
- `src/main.tsx` — import da camada.

### Checklist
- [x] Referência escrita dos tokens existe
- [x] Classes canônicas (`.orbit-contextbar`, `.orbit-surface-toolbar`, `.orbit-statusbar`,
      `.orbit-empty-state`, `.orbit-action`, `.orbit-ai-action`)
- [x] Azul = arquivo · violeta = IA documentado e aplicado
- [x] Estado vazio de projeto saiu do card `rounded-3xl`

---

## Fase 3 — Surface Documento (padrão ouro)

### Arquivos
- `src/components/orbit/DocumentRuler.tsx` — novo: régua em cm sticky, alinhada à folha,
  acompanha o zoom, sombreia margens.
- `src/components/DocumentEditorStudio.tsx` — régua + toggle na status bar; hierarquia
  renumerada: context bar · toolbar · régua · página · status bar.

### Checklist
- [x] Página é o protagonista visual
- [x] Zero stack permanente PowerBar + Find + Pro
- [x] Auto-save, templates, import/export, IA e page setup intactos
- [x] `.orbidoc-rich-editor` preservada
- [x] Toolbar com scroll horizontal no mobile
- [x] Impressão funcional

### Anti-Frankenstein
**Passa.** Abrir um documento mostra context bar, uma toolbar, régua e a folha ocupando o
centro; nada mais é empilhado.

### Como testar
1. Abrir um documento existente → título, conteúdo e “Salvo …” na context bar.
2. Digitar → “Salvo” atualiza; exportar DOCX/PDF; importar DOCX de volta.
3. Trocar A4 ↔ Carta, margens e zoom → folha **e régua** reagem juntas.
4. `Ctrl+H` → drawer abre na aba Localizar; substituir no editor; fechar com Esc.
5. `Alt+Z` → modo foco.

---

## Fase 4 — Surface Planilha

### Arquivos
- `src/components/SpreadsheetEditorStudio.tsx` — context bar única, toolbar única
  (`.orbit-surface-toolbar`), grade protagonista, status bar com abas + métricas,
  `OrbitDrawer` (Resumo · Planilha Pro · Projeto).
- `src/components/SpreadsheetEditor.tsx` — deixa de usar `OrbitEditorFrame`; injeta
  `SpreadsheetProPanel` via `advancedTools`.
- `src/components/orbit/OrbitDrawer.tsx` — novo: drawer compartilhado (redimensionável no
  desktop, sheet no mobile).

### Checklist
- [x] Trocar Doc → Sheet não parece trocar de produto
- [x] Grade legível; chrome secundário não domina
- [x] Recursos preservados: fórmulas, seleção, resize de coluna/linha, import/export,
      abas, análise IA
- [x] Violação V1 sanada (3 faixas → 1 context bar + 1 toolbar)

### Anti-Frankenstein
**Passa.** Documento e planilha compartilham a mesma gramática: context bar, uma toolbar,
protagonista, status bar.

---

## Fase 5 — Surface Repo (GitHub como WorkObject)

### Arquivos
- `src/components/RepoSurface.tsx` — novo: context bar `owner/repo @ branch` + caminho +
  “Abrir no GitHub”; corpo tree + arquivo; estado desconectado honesto.
- `src/components/orbit/RepoTree.tsx` — novo: árvore colapsável com filtro; binários
  esmaecidos.
- `src/components/orbit/RepoFileViewer.tsx` — novo: highlight próprio, gutter sticky,
  numeração de linhas, “somente leitura”.
- `src/services/githubProjects.ts` — `listGitHubBranches()` e `readGitHubRepository()`.
- `src/AppV5.tsx` — view `repos`, item de nav “Repositórios”, deep link por evento.
- `src/main.tsx` — overlay removido.
- `src/components/GitHubProjectsWorkspace.tsx` — **removido** (modal `rounded-3xl`).

### Checklist
- [x] Repo é item de workspace, não só menu “Integrações”
- [x] Tree + arquivo no contrato de surface (sem card Frankenstein)
- [x] Branch switch funciona (seletor + recarga da árvore)
- [x] Binários: mensagem simples, não quebram a surface
- [x] Link externo para github.com
- [x] Sem iframe; sem exigir escrita no MVP
- [x] Passa no teste anti-Frankenstein ao alternar Doc ↔ Repo

### Limitação assumida
**Monaco não foi adotado.** O guia recomenda `@monaco-editor/react`; o loader padrão busca o
runtime de um CDN, o que quebraria o produto offline-first (PWA com precache, verificado por
`verify:pwa`) e somaria ~5 MB ao bundle — contra a regra absoluta §0 (“não adicionar
dependências grandes sem justificativa na fase atual”). O highlight próprio vive atrás da
fronteira `RepoFileViewer`, então trocar o miolo por Monaco/CodeMirror depois não toca a
surface. Funções de escrita (`saveGitHubTextFile`) permanecem no conector, prontas para uma
fase de edição.

---

## Fase 6 — Command palette e busca unificada

### Arquivos
- `src/components/orbit/OrbitCommandPalette.tsx` — seção “Objetos”: projetos locais
  (`orbidoc_projects_v1` → WorkObject) e repositórios recentes; abertura por evento.
- `src/AppV5.tsx` — escuta `orbit:open-object` e abre o projeto por id.
- `src/components/RepoSurface.tsx` — memoriza repositórios abertos e escuta `orbit:open-repo`.

### Checklist
- [x] `Ctrl/Cmd+K` abre a palette
- [x] Busca WorkObjects por título (documentos, planilhas, apresentações, repos)
- [x] Ações de criação preservadas
- [x] `Ctrl/Cmd+P` foca objetos
- [x] Sem tentar ser um Spotlight de SO completo

---

## Fase 7 — Inspector global

**Não iniciada.** Painéis contextuais continuam dentro de cada surface (inspetores de
apresentação e design, drawer de documento e planilha). Registrado como próximo passo, junto
com: migração opcional para Lucide e adoção de inspector no shell.

---

## Verificação executada

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ 127 arquivos |
| `npx tsc --noEmit` | ✅ limpo |
| `npm test` | ✅ **86/86** (5 testes novos de contrato) |
| `npm run build` | ✅ |
| `verify:mobile` | ✅ |
| `verify:nexus` | ✅ |
| `verify:pwa` | ✅ |
| `check-orbidoc-brand` | ✅ |
| `verify:auth` | ⚠️ bloqueio de rede do sandbox (`identitytoolkit.googleapis.com`) — não relacionado |

**Não validado visualmente:** o sandbox bloqueia o download do Chromium; não houve conferência
por screenshot. O checklist acima é o roteiro de QA manual.

---

## Não feito / próximo

1. **Fase 7 (inspector global)** — não iniciada.
2. **Inspetores de apresentação e design** ainda usam `OrbitEditorFrame`; falta dar a eles a
   mesma context bar única do doc/planilha.
3. **Lucide** — 49 arquivos seguem em Tabler (uma única família, mesmo stroke 2). Migrar é
   churn sem ganho de produto e com risco nos verificadores; decisão registrada.
4. **`rounded-3xl` residual** em 5 páginas de catálogo (PDF/OCR, Imagens, Dashboards, Nuvem,
   Hub). Higiene pendente pela regra “ao tocar no arquivo, corrija”.
5. **Escrita no GitHub** (commit pela UI) fora do MVP por decisão do próprio comando.
