# AUDIT-FASE-0 — Inventário e mapa anti-Frankenstein

**Data:** 2026-09-12 · **Branch:** `arena/01a0618a-orbidoc` · **HEAD:** `3e42185`
**Escopo:** auditoria somente leitura. Nenhuma feature foi editada para produzir este documento.

---

## 1. Cadeia de shells (entrypoints)

```
src/main.tsx
  └ AppErrorBoundary
      └ OrbitAppShell            (orbit/OrbitAppShell.tsx, 43 linhas)
          └ OrbiDocExperienceShell (OrbiDocExperienceShell.tsx, 172 linhas — gate de login/launch)
              └ AppV5             (AppV5.tsx, 703 linhas — o frame real do produto)
                  ├ header 48px            (orbit-hide-on-focus)
                  ├ main.orbit-workspace-main[data-orbit-surface]
                  ├ BottomNavBar
                  └ FabMenuSheet
      + 11 overlays irmãos (launchers, agentes, modais)
```

**Veredito:** já existe **uma** cadeia de layout, sem segundo “app frame”. `OrbitAppShell` é fino
(skip link + banner offline + `data-orbit-shell="v2"`), `OrbiDocExperienceShell` é gate de
autenticação. **Não há shell morto para remover.**

### Cadeia flex do main (verificada)

```
.orbit-workspace-main[data-orbit-surface='editor']
  overflow:hidden · padding:0 · display:flex (via .orbit-editor-surface)
  > .orbit-workspace-canvas { flex:1 1 auto; min-height:0; max-width:none }
```
✅ Superfícies em tela cheia não têm double scroll.
⚠️ **FASE 1 — GAP:** `viewport height` da cadeia: o `<main>` usa `flex-1` mas o contêiner
`.orbit-workspace-canvas` só é `flex` no ramo `[data-orbit-surface='editor']`. OK.

---

## 2. Superfícies / editores

| # | Surface | Arquivo | Barras permanentes acima do protagonista | Card container raiz | `min-h-[calc(100dvh` | Título duplicado |
|---|---------|---------|:---:|:---:|:---:|:---:|
| 1 | **Documento** | `DocumentEditor.tsx` + `DocumentEditorStudio.tsx` | **2** (context bar + toolbar) ✅ | não ✅ | não ✅ | **SIM** ⚠️ (shell header + context bar) |
| 2 | **Planilha** | `SpreadsheetEditor.tsx` + `SpreadsheetEditorStudio.tsx` | **3** ⚠️ (chrome OrbitEditorFrame + header do studio + toolbar do studio) | não ✅ | não ✅ | **SIM** ⚠️ |
| 3 | **Apresentação** | `PresentationEditor.tsx` + `...Studio.tsx` | 1 (chrome) + toolbar própria de slide | não ✅ | não ✅ | SIM ⚠️ |
| 4 | **Design** | `DesignEditor.tsx` + `...Studio.tsx` | 1 (chrome) + header próprio do studio | não ✅ | não ✅ | SIM ⚠️ |
| 5 | PDF & OCR | `PdfOcrWorkspace.tsx` | 1 card de cabeçalho | **SIM** (`rounded-3xl`) ⚠️ | não | — |
| 6 | Imagens | `ImageWorkspace.tsx` | 1 card de cabeçalho | **SIM** ⚠️ | não | — |
| 7 | Áudio | `AudioWorkspace.tsx` | 1 | não | não | — |
| 8 | Dashboards | `AnalyticsWorkspace.tsx` | 1 card de cabeçalho | **SIM** ⚠️ | não | — |
| 9 | Nuvem | `CloudWorkspace.tsx` | 1 card de cabeçalho | **SIM** ⚠️ | não | — |
| 10 | Arquivos | `FilesWorkspace.tsx` | 1 (page) | não | não | — |
| 11 | Nexus AI | `AiWorkspace.tsx` | composer inferior (correto) | não | não | não |
| 12 | **GitHub** | `GitHubProjectsWorkspace.tsx` | — | **SIM** (`rounded-3xl`) | — | — |

### Violações estruturais confirmadas

- **V1 — Barras empilhadas (Fase 4).** Planilha tem **3** faixas permanentes acima da grade:
  `orbit-editor-chrome` (Versão/Backup/Atalhos/Ferramentas) + header do studio (título, import,
  export) + toolbar do studio (fx, formatação). Contrato permite 1 context bar + 1 toolbar.
- **V2 — Título do objeto em 2 lugares.** `AppV5` header renderiza `activeTitle`
  (`AppV5.tsx:655`) **e** a surface renderiza o mesmo título na própria context bar
  (`DocumentEditorStudio.tsx`, `SpreadsheetEditorStudio.tsx`, `DesignEditorStudio.tsx`).
  Contrato: escolher **um** dono.
- **V3 — GitHub é overlay, não WorkObject.** `GitHubProjectsWorkspace.tsx` é um modal
  (`document.body.style.overflow`, `z-index` alto, aberto por `window` event
  `orbidoc:open-github`). Não há `kind: 'repo'`, não aparece na lista de objetos, não é
  pesquisável pela command palette.
- **V4 — `rounded-3xl` como container raiz de página.** 5 páginas de catálogo
  (PDF/OCR, Imagens, Dashboards, Nuvem, OrbiDoc Hub) + o modal GitHub.
- **V5 — Command palette busca comandos, não objetos.** `OrbitCommandPalette.tsx` lista
  ações fixas e executa `clickButton(text)` sobre o DOM. Não indexa documentos/planilhas por
  título, como a Fase 6 pede.
- **V6 — Sem inspector global.** Cada surface inventa seu painel direito (insights da planilha,
  inspetor de apresentação, inspetor de design). Fase 7 não iniciada.

### `min-h-[calc(100dvh-…)]` residual

Busca em `src/`: **0 ocorrências** em superfícies. ✅ (A regra de neutralização em
`orbit-workspace.css` permanece como cinto de segurança para código legado.)

---

## 3. Estado do modelo WorkObject

`src/types.ts` → `SavedProject` (já é quase um WorkObject):

```ts
{ id, title, type: 'word'|'excel'|'powerpoint'|'canva'|'extract'|'chat',
  updatedAt, createdAt, previewSnippet?, details?, summary?, category?,
  thumbnailColor?, tags?, content? }
```

Mapa para `WorkObjectKind`:

| `SavedProject.type` | `WorkObject.kind` | `source` |
|---|---|---|
| `word` | `doc` | `local` |
| `excel` | `sheet` | `local` |
| `powerpoint` | `deck` | `local` |
| `canva` | `file` (mídia) | `local` |
| `extract` | `file` | `local` |
| `chat` | `chat` | `local` |
| — (novo) | `repo` | `github` |

**Ação:** criar `WorkObject` como tipo derivado (adaptador), **sem** migrar
`localStorage.orbidoc_projects_v1` nem quebrar `SavedProject`. Preservação tem prioridade 2.

---

## 4. Conectores existentes

| Conector | Arquivo | Estado |
|---|---|---|
| GitHub | `src/services/githubProjects.ts` (336 linhas) | ✅ completo: OAuth App, `listGitHubRepositories`, `loadGitHubRepositoryTree`, `readGitHubTextFile`, `saveGitHubTextFile`, `downloadGitHubRepository` |
| Google Drive | `src/services/googleAuthDrive.ts` | ✅ |
| Microsoft | `src/services/microsoftAuthOffice.ts` | ✅ |
| OAuth token GitHub | `api/github/oauth-token.ts` | ✅ server-side |

**Conclusão:** a Fase 5 **não precisa de conector novo** — só de uma surface que consuma o
serviço existente no contrato.

---

## 5. Ferramentas disponíveis (sem dependência nova)

| Necessidade | Já instalado | Observação |
|---|---|---|
| Ícones (Lucide) | `lucide-react@1.26` ✅ | usado em 4 arquivos; Tabler em 49 |
| Virtualização (tree de repo) | `react-virtuoso@4.18` ✅ | já em `package.json` |
| Editor de código | ❌ não instalado | ver decisão §6 |
| Tokens CSS | `src/index.css` (`--workspace-*`, `--brand-*`) ✅ | + `orbit-system.css`, `orbit-workspace.css` |

---

## 6. Decisões de escopo tomadas a partir da auditoria

1. **Fase 1** — a cadeia já é única; resta **V2** (título duplicado) e **V4** no estado vazio.
2. **Fase 4** — remover 1 das 3 faixas da planilha e dar a ela a mesma gramática do documento
   (context bar → toolbar → grade → status bar), com o painel Pro/insights no drawer.
3. **Fase 5** — promove `GitHubProjectsWorkspace` a surface de primeira classe com
   `kind: 'repo'`, reaproveitando `services/githubProjects.ts`.
   **Monaco não entra:** carregador padrão do `@monaco-editor/react` busca do CDN, o que
   quebraria o produto offline-first (PWA com precache e `verify:pwa`) e adicionaria ~5 MB ao
   bundle. O guia permite alternativa leve; a implementação usa um visualizador com highlight
   próprio atrás de uma fronteira de componente (`RepoFileViewer`) para permitir troca futura.
4. **Fase 6** — estender a palette existente para indexar `WorkObject`s por título.
5. **Lucide** — **não** migrar os 49 arquivos Tabler. Tabler e Lucide são a mesma família
   visual (stroke 2, canvas 24) e a migração é churn sem ganho de produto, com risco de
   regressão nos 11 verificadores de build. Registrado como “não feito”.
6. **Fase 7** — fora do escopo desta rodada (registrado como próximo passo).
7. **Logo** — intocada, conforme instrução explícita do proprietário.

---

## 7. Ordem de execução desta rodada

| Fase | Status de partida | Ação | Resultado |
|---|---|---|---|
| 0 | — | este documento | ✅ |
| 1 | 80% pronto | tipo `WorkObject` + remover título duplicado + estado vazio sem card | ✅ V2 sanada |
| 2 | parcial | `docs/ORBIT-TOKENS.md` + tokens semânticos faltantes | ✅ |
| 3 | 95% pronto | régua em cm + revisão do contrato | ✅ |
| 4 | violado (V1) | planilha no mesmo contrato | ✅ V1 sanada |
| 5 | violado (V3) | `RepoSurface` + `kind: 'repo'` na nav | ✅ V3 sanada |
| 6 | parcial (V5) | palette indexando WorkObjects | ✅ V5 sanada |
| 7 | não iniciado | fora desta rodada | ⏳ próximo |

Relatório de entrega com checklist por fase, teste anti-Frankenstein e riscos:
`ORBIT-ENTREGA.md`.
