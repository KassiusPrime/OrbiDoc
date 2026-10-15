# Refatoração do Editor de Documentos — Orbit (v2)

> Hierarquia estilo Google Docs: a folha é a protagonista, as ferramentas avançadas vivem em um drawer lateral.
>
> **Branch:** `arena/01a08ecd-orbidoc` (base: `1c75bbd` de `main`)
> **Data:** 11/09/2026
> **Commit sugerido:** `refactor(document): Google Docs hierarchy — page protagonist, drawer for advanced tools`

---

## Sumário

1. [Objetivo e critérios de aceite](#1-objetivo-e-critérios-de-aceite)
2. [Diagnóstico do estado anterior](#2-diagnóstico-do-estado-anterior)
3. [Arquitetura resultante](#3-arquitetura-resultante)
4. [Arquivos alterados (detalhe por arquivo)](#4-arquivos-alterados-detalhe-por-arquivo)
5. [Anatomia do novo editor](#5-anatomia-do-novo-editor)
6. [Drawer "Avançado"](#6-drawer-avançado)
7. [Cadeia de altura e integração com o shell AppV5](#7-cadeia-de-altura-e-integração-com-o-shell-appv5)
8. [Funcionalidades preservadas (inventário)](#8-funcionalidades-preservadas-inventário)
9. [Atalhos, acessibilidade e comportamento por dispositivo](#9-atalhos-acessibilidade-e-comportamento-por-dispositivo)
10. [Constantes, chaves de armazenamento e contratos](#10-constantes-chaves-de-armazenamento-e-contratos)
11. [Verificação executada](#11-verificação-executada)
12. [Smoke test visual (Chromium headless)](#12-smoke-test-visual-chromium-headless)
13. [Problemas encontrados e correções durante o trabalho](#13-problemas-encontrados-e-correções-durante-o-trabalho)
14. [Decisões de design e alternativas descartadas](#14-decisões-de-design-e-alternativas-descartadas)
15. [Como commitar e publicar](#15-como-commitar-e-publicar)
16. [Checklist de QA manual](#16-checklist-de-qa-manual)
17. [Riscos, limitações e próximos passos](#17-riscos-limitações-e-próximos-passos)
18. [Apêndice A — Diff resumido](#apêndice-a--diff-resumido)
19. [Apêndice B — Mapa de classes/ids para automação](#apêndice-b--mapa-de-classesids-para-automação)

---

## 1. Objetivo e critérios de aceite

A spec "Refatoração do Editor de Documentos — Orbit (v2)" pediu que `src/components/DocumentEditorStudio.tsx` e `src/components/DocumentEditor.tsx` fossem reorganizados para que a **página** voltasse a ser o centro da experiência, no espírito do Google Docs.

| # | Requisito | Status |
|---|-----------|--------|
| 1 | **Zero barras empilhadas por padrão.** PowerBar, Localizar/Substituir e Painel Pro saem do fluxo vertical e passam a viver em um drawer lateral, aberto apenas por um botão flutuante "Avançado". | ✅ |
| 2 | **Sem conflito com o shell AppV5.** Remover restrições do tipo `min-h-[calc(100dvh-7rem)]`; usar `h-full min-h-0` em toda a cadeia flex. | ✅ |
| 3 | **Página como protagonista.** Context bar fina (título + indicador de salvamento + modelos/importar/exportar), toolbar de formatação sticky, folha branca central, status bar inferior (palavras, busca, zoom, margens). | ✅ |
| 4 | **Remover** o contêiner-cartão `rounded-3xl`, a pilha permanente StudioPowerBar + FindReplace + ProPanel e qualquer botão recolhível que ainda ocupasse altura acima da página. | ✅ |
| 5 | **Preservar** auto-save (localStorage + projeto), modelos, import DOCX/HTML/TXT/MD, export DOCX/PDF/HTML/TXT, IA (melhorar/resumir/expandir), page setup, undo/redo, listas, tabela, imagem, link, cores e a classe `.orbidoc-rich-editor` (o FindReplaceBar e o ProPanel consultam o DOM por ela). | ✅ |

Restrições explícitas mantidas durante todo o trabalho:

- Não reintroduzir `rounded-3xl` como cartão do editor.
- Não usar `min-h-[calc(100dvh-…)]` (nem variantes como `h-[calc(var(--orbidoc-visual-height)-…)]`).
- Não deixar PowerBar/FindReplace/ProPanel empilhados permanentemente.
- Não colocar um toggle recolhível que ocupe altura acima da folha.
- Manter `.orbidoc-rich-editor` no elemento `contentEditable`.

---

## 2. Diagnóstico do estado anterior

**`DocumentEditor.tsx` (7 linhas)** era um wrapper que empilhava tudo verticalmente:

```tsx
<div>
  <StudioPowerBar project={…} kind="word" … />     // barra "Studio Pro" sempre visível
  <DocumentFindReplaceBar … />                     // botão "Localizar e substituir" sempre visível
  <DocumentProPanel … />                           // seção "Documento Pro" recolhida, mas ocupando altura
  <DocumentEditorStudio {...props} />              // o editor em si
</div>
```

**`DocumentEditorStudio.tsx` (298 linhas)** renderizava o editor em um cartão:

```tsx
<div className="rounded-3xl border … overflow-hidden min-h-[calc(100dvh-8rem)] flex flex-col">
```

Consequências observadas:

- Três faixas de UI antes da primeira linha do documento (PowerBar, botão de Localizar, cabeçalho do Pro Panel), além da toolbar do próprio editor.
- O `min-h-[calc(100dvh-8rem)]` competia com o `<main>` do AppV5 (que já é `flex-1 min-h-0 overflow-y-auto`), resultando em duplo scroll e em um editor mais alto do que a viewport.
- Cartão `rounded-3xl` com fundo cinza envolvendo tudo, deslocando a folha para dentro de mais uma moldura.

---

## 3. Arquitetura resultante

```
AppV5 <main class="flex-1 min-h-0 overflow-y-auto …">
 └─ <div class="max-w-[1520px] mx-auto h-full min-h-0">        ← 1 linha alterada (só na view 'word')
     └─ DocumentEditor  (wrapper fino)
         └─ DocumentEditorStudio  advancedTools={<FindReplace embedded/> <ProPanel defaultOpen/> <PowerBar layout="stack"/>}
             ├─ Context bar     (h-12)  título · salvo · Modelos ▾ · Importar · Nexus AI ▾ · Exportar ▾
             ├─ Toolbar         (sticky) estilo · fonte · tamanho · undo/redo · B I U S · cores · alinhamento · listas · recuo · link · tabela · hr · imagem · limpar
             ├─ Área central    (flex-1 min-h-0 flex)
             │   ├─ Canvas rolável (.orbidoc-editor-canvas)  →  Folha (.orbidoc-page) → contentEditable (.orbidoc-rich-editor)
             │   ├─ FAB "Avançado" (.orbidoc-advanced-fab)  — absoluto, canto inferior direito do canvas
             │   └─ Drawer inline (≥1024px)  <aside id="orbidoc-advanced-drawer" role="complementary" class="w-[360px]">
             ├─ Status bar      (min-h-9) palavras · caracteres · pág. · busca · A4/Carta · margens · espaçamento · zoom
             └─ Drawer overlay (<1024px) <div class="absolute inset-0 z-30"> backdrop + <aside role="dialog" aria-modal>
```

Princípios:

- **O `DocumentEditorStudio` é dono do drawer.** Ele recebe o conteúdo via prop `advancedTools?: React.ReactNode`. Se a prop for omitida, nem o FAB nem o drawer são renderizados (o componente continua utilizável isoladamente).
- **`DocumentEditor` só compõe.** Ele injeta os três painéis já existentes, cada um em um modo novo de renderização (`embedded`, `defaultOpen`, `layout="stack"`), sem duplicar lógica.
- **Nada muda para os outros editores.** `StudioPowerBar` mantém `layout="bar"` como padrão, então `SpreadsheetEditor`, `PresentationEditor` e `DesignEditor` renderizam exatamente como antes.
- **O teste `tests/product-workspaces.test.ts`** continua satisfeito: ele exige o literal `DocumentFindReplaceBar` dentro de `DocumentEditor.tsx`, e o wrapper continua importando e usando o componente.

---

## 4. Arquivos alterados (detalhe por arquivo)

```
 src/AppV5.tsx                             |   2 +-
 src/components/DocumentEditor.tsx         |  22 +-
 src/components/DocumentEditorStudio.tsx   | 451 +++++++++++++++++++++++++++---
 src/components/DocumentFindReplaceBar.tsx |  42 ++-
 src/components/DocumentProPanel.tsx       |  10 +-
 src/components/StudioPowerBar.tsx         |   4 +-
 src/index.css                             |   3 +
 7 files changed, 472 insertions(+), 62 deletions(-)
```

### 4.1 `src/components/DocumentEditorStudio.tsx` (298 → 661 linhas, reescrito)

Novidades estruturais:

- Prop `advancedTools?: React.ReactNode` na interface `DocumentEditorStudioProps` (documentada com JSDoc).
- Tipos novos: `ExportFormat`, `AiAction`, `OpenMenu = 'export' | 'ai' | 'templates' | null`.
- Constantes novas: `ZOOM_STEPS`, `WIDE_LAYOUT_QUERY`, `EXPORT_OPTIONS`, `AI_ACTIONS` (id, rótulo, dica e instrução de sistema), `TEMPLATE_OPTIONS`, `PRINT_MARGINS_MM`.
- Hooks locais: `useMediaQuery(query)` (com `matchMedia` + listener `change`) e `useSoftKeyboard()` (escuta `orbidoc:keyboard-visibility` emitido pelo `NativeViewportAgent`; estado inicial lido de `document.documentElement.dataset.orbidocKeyboard === 'open'`).
- Helper `keepEditorSelection` (`onMouseDown → preventDefault`) aplicado aos botões da toolbar e ao FAB para não roubar a seleção do `contentEditable`.
- Estado: `menu` (um único menu aberto por vez), `advancedOpen`, `zoom`, `search`, `aiBusy`, `exportBusy`, `lastSaved`, `pageSetup`, `title`, `html`.
- Refs: `editorRef`, `fileInputRef`, `imageInputRef`, `exportMenuRef`, `aiMenuRef`, `templatesMenuRef`, `drawerRef`, `drawerCloseRef`, `focusFindOnOpenRef`, `searchCursorRef`.
- Derivados: `wideLayout`, `softKeyboardOpen`, `hasAdvancedTools`, `showDrawer = hasAdvancedTools && advancedOpen`, `showFab = hasAdvancedTools && !advancedOpen && !softKeyboardOpen`.
- Efeitos:
  1. Sincroniza `innerHTML` do editor quando `project.id` muda.
  2. Auto-save com debounce de 550 ms → `localStorage` (documento + page setup) + `onProjectChange(updated)` + `lastSaved` (HH:MM pt-BR).
  3. Atalhos globais quando há `advancedTools`: `Ctrl/Cmd+H` (sem Shift/Alt) abre o drawer com foco no campo Localizar; `Esc` fecha o drawer.
  4. Ao abrir o drawer: `requestAnimationFrame` → foca e seleciona `[data-orbidoc-find-input]` se veio de Ctrl+H; caso contrário, em layout estreito, foca o botão "Fechar" (foco entra no diálogo).
  5. Menus (Modelos/Nexus AI/Exportar): fecham em clique fora (`mousedown` fora dos três refs) e em `Esc`.
- Funções de edição: `exec`, `applyFontSize` (converte `<font size="7">` em `<span style="font-size">`), `normalizeLegacyFormatting`, `syncFromEditor`, `replaceDocument`, `insertTable`, `insertLink` (valida `http:`/`https:`/`mailto:`), `insertImage` (≤ 15 MB, Data URL em `<figure>`), `importDocument`, `exportAs`, `printDocument`, `runAi`, `applyTemplate`, `jumpToNextMatch`, `focusPageEnd`, `stepZoom`.
- Removidos em relação à v1 da reescrita: os três botões de IA inline na toolbar (viraram o menu "Nexus AI" na context bar) e o `<select>` de modelos (virou o menu "Modelos"), reduzindo a toolbar a formatação pura.

### 4.2 `src/components/DocumentEditor.tsx` (7 → 27 linhas)

```tsx
export const DocumentEditor: React.FC<React.ComponentProps<typeof DocumentEditorStudio>> = (props) => (
  <DocumentEditorStudio
    {...props}
    advancedTools={(
      <>
        <DocumentFindReplaceBar embedded showNotification={props.showNotification} />
        <DocumentProPanel defaultOpen showNotification={props.showNotification} />
        <StudioPowerBar project={props.project} kind="word" layout="stack" showNotification={props.showNotification} />
      </>
    )}
  />
);
```

Consumidores: `src/AppV5.tsx` (view `word`) e `src/components/WordEditor.tsx` (legado). Nenhum precisou mudar de assinatura.

### 4.3 `src/components/DocumentFindReplaceBar.tsx` (+ prop `embedded`)

- `type Props = { showNotification?; embedded?: boolean }`.
- `embedded = true`: estado `open` já inicia `true`; **não** registra o listener global de `Ctrl+H`/`Esc` (o host cuida disso); layout vertical em `<section aria-label="Localizar e substituir">` com cabeçalho (ícone + título + "Ctrl+H"), campo Localizar, campo Substituir, linha "Diferenciar maiúsculas + Próxima" e grade 2 colunas "Substituir | Substituir tudo".
- O input de busca ganhou `data-orbidoc-find-input="true"` e `aria-label="Localizar"`; `autoFocus={!embedded}` evita roubar o foco quando o drawer abre por clique.
- Os campos/botões foram extraídos para constantes JSX (`findField`, `replaceField`, `caseToggle`, `nextButton`, `replaceButton`, `replaceAllButton`) reutilizadas pelos dois layouts; botões ganharam `whitespace-nowrap`.
- **Modo não-embutido permanece idêntico** (botão recolhido + barra horizontal com X), para qualquer outro uso futuro.

### 4.4 `src/components/DocumentProPanel.tsx` (+ prop `defaultOpen`)

- `defaultOpen?: boolean` → estado inicial de `open`.
- Removido `mb-3` (o drawer controla o espaçamento com `space-y-3`).
- A grade interna passou de `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` para `grid-cols-1 gap-3` com `p-3` — dentro de uma coluna de 360 px só faz sentido uma coluna. Toda a lógica (cabeçalho/rodapé, comentários, notas de rodapé, sumário, auditoria de acessibilidade) está intacta.

### 4.5 `src/components/StudioPowerBar.tsx` (+ prop `layout`)

- `layout?: 'bar' | 'stack'` com padrão `'bar'`.
- `'stack'`: remove `mb-2` e faz o bloco de título ocupar `w-full`, deixando os botões "Criar versão / Backup / Atalhos" na linha de baixo. Nenhuma mudança para `'bar'` (usado por planilha, apresentação e design).

### 4.6 `src/AppV5.tsx` (1 linha)

```diff
- <div className={view === 'chat' || view === 'ai' || view === 'compare' ? '' : 'max-w-[1520px] mx-auto'}>{renderContent()}</div>
+ <div className={view === 'chat' || view === 'ai' || view === 'compare' ? '' : `max-w-[1520px] mx-auto${view === 'word' ? ' h-full min-h-0' : ''}`}>{renderContent()}</div>
```

Fecha a cadeia de altura entre o `<main>` e o editor apenas na view de documento; as outras views continuam com o comportamento original (conteúdo cresce e o `main` rola).

### 4.7 `src/index.css` (+3 linhas)

```css
.orbidoc-rich-editor ul { list-style: disc outside; }
.orbidoc-rich-editor ol { list-style: decimal outside; }
.orbidoc-rich-editor ul ul { list-style-type: circle; }
```

O preflight do Tailwind 4 zera `list-style` em `ul/ol`; sem esta regra os marcadores e a numeração das listas não apareciam na folha (confirmado no primeiro screenshot).

---

## 5. Anatomia do novo editor

### 5.1 Contêiner

```
.orbidoc-document-studio  relative h-full min-h-0 flex flex-col overflow-clip
                          rounded-[12px] lg:rounded-[16px] border border-[var(--orbit-border)]
                          bg-[var(--orbit-surface)]
```

- `overflow-clip` (não `hidden`) para conter o FAB/drawer absolutos sem criar um novo contexto de rolagem.
- Raio discreto (12/16 px) alinhado aos tokens do Orbit System em vez do cartão `rounded-3xl`.

### 5.2 Context bar (`h-12`)

| Elemento | Detalhe |
|----------|---------|
| Ícone `FileText` | azul `#3157F6` |
| Título | `<input aria-label="Nome do documento">` transparente, `min-w-[6rem] flex-1`, hover/focus com fundo suave |
| Indicador de salvamento | `Check` verde + "Salvo HH:MM" (texto oculto em telas `< sm`, só o ícone); `Loader` girando enquanto "Salvando…" |
| **Modelos ▾** | menu com Relatório empresarial · Trabalho escolar · Ata de reunião · Proposta. Pede `window.confirm` se já houver conteúdo |
| **Importar** | abre `<input type="file" accept=".docx,.html,.htm,.txt,.md">` |
| **Nexus AI ▾** | menu violeta com Melhorar escrita · Resumir · Expandir (cada item mostra uma dica de uma linha); mostra spinner + "Nexus AI…" enquanto processa |
| **Exportar ▾** | botão primário azul; menu com Word (DOCX) · PDF · Página web (HTML) · Texto simples (TXT) · separador · Imprimir |

Em telas `< sm` os rótulos textuais dos botões somem e ficam só os ícones, então a barra cabe em 390 px sem quebrar linha (verificado).

### 5.3 Toolbar de formatação (sticky)

`<OrbitToolbar label="Formatação do documento" compact className="sticky top-0 z-20 shrink-0 lg:flex-wrap border-b …">`

- No touch/tablet a toolbar rola horizontalmente (comportamento nativo de `.orbit-context-strip`); em `lg+` quebra em duas linhas.
- Grupos, na ordem: Estilo de parágrafo (Normal, Título 1–3, Citação, Código) · Fonte (`OFFICE_FONTS`) · Tamanho (10–60) │ Desfazer · Refazer │ Negrito · Itálico · Sublinhado · Tachado · Cor do texto · Marca-texto │ Alinhar à esquerda · Centralizar · Alinhar à direita · Justificar │ Lista com marcadores · Lista numerada · Diminuir recuo · Aumentar recuo │ Inserir link · Inserir tabela · Linha horizontal · Inserir imagem · Limpar formatação.
- Todos os botões têm `title` e usam `onMouseDown={keepEditorSelection}`.

### 5.4 Canvas e folha

- Canvas: `.orbidoc-editor-canvas flex-1 min-h-0 overflow-auto overscroll-contain bg-[#f1f4f9] dark:bg-[#0b0d11] px-2 pt-3 pb-16 sm:px-8 sm:pt-8 sm:pb-20` — é **o único elemento que rola** na view de documento.
- Folha: `.orbidoc-page mx-auto bg-white text-slate-900 border shadow-…` com estilo inline `width: PAGE_WIDTH[size]`, `minHeight: PAGE_HEIGHT[size]`, `padding: MARGINS[margins]`, `maxWidth: zoom > 100 ? 'none' : '100%'`, `zoom: zoom/100`.
- Clique na margem da folha (fora do texto) chama `focusPageEnd`, posicionando o cursor no fim do documento.
- Editor: `<div contentEditable className="orbidoc-rich-editor outline-none text-[15px]" style={{ lineHeight, minHeight: PAGE_HEIGHT - 2*margin }}>` com `onInput`/`onBlur → syncFromEditor`.
- Fundo do canvas em modo escuro é escuro, mas a folha permanece branca com texto escuro (fiel ao papel).

### 5.5 Status bar (`min-h-9`)

`{words} palavras · {chars} caracteres (md+) · {pages} pág. · [🔍 Buscar no documento] · {n} ocorrência(s) · … · A4/Carta · Margem estreita/normal/larga · 1,2/1,5/2,0 (sm+) · [− 100% +]`

- A busca rápida conta ocorrências em tempo real; **Enter** chama `jumpToNextMatch`, que percorre os nós de texto com `TreeWalker`, seleciona a próxima ocorrência (`Range`) e faz `scrollIntoView({ block: 'center' })`.
- Zoom em passos fixos `50 · 75 · 90 · 100 · 110 · 125 · 150 · 200`; clicar no percentual volta a 100 %.
- `pr-16 lg:pr-3`: reserva espaço à direita em telas menores para que o FAB não cubra os controles de zoom; a barra rola horizontalmente se faltar espaço (`overflow-x-auto`, scrollbar oculta).
- Estimativa de páginas: `Math.max(1, Math.ceil(words / 520))`.

---

## 6. Drawer "Avançado"

### 6.1 Botão flutuante (FAB)

```
button.orbidoc-advanced-fab  absolute right-3 bottom-3 sm:right-5 sm:bottom-5 z-20 h-11 rounded-full
                             bg-[#3157F6] text-white  "Avançado"  (ícone Adjustments)
title="Ferramentas avançadas · Ctrl+H para localizar e substituir"
```

- Posicionado **dentro do canvas** (não `fixed`), então nunca colide com os launchers globais do `main.tsx` (Redimensionar / Versões / Scan & Reader) nem com a bottom nav mobile.
- Oculto quando o drawer está aberto ou quando o teclado virtual está visível (`useSoftKeyboard`), para não cobrir a área de digitação em Android/PWA.

### 6.2 Painel

```html
<aside id="orbidoc-advanced-drawer" aria-label="Ferramentas avançadas"
       role="complementary" (≥1024px)  |  role="dialog" aria-modal="true" (<1024px)>
  <header h-12>  ⚙ Ferramentas avançadas / Localizar · Documento Pro · Studio Pro   [X aria-label="Fechar ferramentas avançadas"]
  <div flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3>{advancedTools}</div>
</aside>
```

| Breakpoint | Apresentação |
|------------|--------------|
| `≥ 1024px` (`WIDE_LAYOUT_QUERY`) | Coluna inline à direita da folha, `w-[360px] shrink-0`, borda esquerda. A folha continua editável e visível ao lado; o canvas simplesmente encolhe. |
| `< 1024px` | Overlay `absolute inset-0 z-30` **dentro do editor** (não cobre header/sidebar/bottom nav do shell): backdrop `bg-slate-950/35 backdrop-blur-[1px]` que fecha ao toque + painel `h-full w-full max-w-[400px]` alinhado à direita com `shadow-2xl`. |

O conteúdo do drawer tem seu próprio scroll; a folha por trás não rola junto (`overscroll-contain`).

### 6.3 Ciclo de vida

| Ação | Resultado |
|------|-----------|
| Clique no FAB | `advancedOpen = true`; em layout estreito, foco vai ao botão Fechar |
| `Ctrl/Cmd + H` (sem Shift/Alt) | abre o drawer **e** foca + seleciona o campo Localizar (`[data-orbidoc-find-input]`) |
| `Esc` | fecha o drawer (se aberto) — menus também fecham com Esc |
| Clique no X ou no backdrop | fecha o drawer |
| Drawer fechado | FAB reaparece (exceto com teclado virtual aberto) |

`Ctrl+Shift+H` continua livre para o atalho global do `main.tsx` (Histórico) — o filtro `!event.shiftKey && !event.altKey` garante isso.

---

## 7. Cadeia de altura e integração com o shell AppV5

O shell (`.orbit-app-shell`) é `overflow: hidden; height: var(--orbidoc-visual-height, 100dvh)` e o `<main>` é `flex-1 min-h-0 overflow-y-auto`. Para que o editor ocupe exatamente a área útil, cada nível precisa propagar altura:

```
main (flex-1 min-h-0)            → altura definida pelo shell
 └ div.max-w-[1520px] h-full min-h-0    ← ANTES faltava; sem isso o editor crescia com o conteúdo
    └ .orbidoc-document-studio h-full min-h-0 flex flex-col
       └ área central flex-1 min-h-0 flex
          └ .orbidoc-editor-canvas flex-1 min-h-0 overflow-auto   ← único scroll
```

Medições no Chromium headless (antes → depois da linha no AppV5):

| Viewport | `<main>` | `.orbidoc-document-studio` antes | depois | `main.scrollHeight` depois |
|----------|----------|-----------------------------------|--------|----------------------------|
| Desktop 1440×900 | 836 px | **1425 px** | 730 px | 836 (= clientHeight → sem scroll externo) |
| Tablet 820×1100 | 1036 px | 1498 px | 862 px | 1036 |
| Mobile 390×844 | 780 px | **2687 px** | 677 px | 780 |

Resultado: a toolbar e a status bar ficam sempre visíveis, a folha rola dentro do editor e o `<main>` não rola mais na view de documento. Nenhum `min-h-[calc(100dvh-…)]` foi usado.

Compatibilidade com CSS global verificada:

- `src/orbidoc-ui.css` força `border-radius`/hover em `main .rounded-3xl.border` e `.rounded-2xl.border` — o contêiner do editor não usa essas classes, então não é afetado. Os painéis dentro do drawer (que usam `rounded-2xl`) recebem o estilo global normalmente.
- `main input/select` recebem `border-radius: var(--orbi-control-radius) !important` — compatível com os `rounded-[8px]` usados.
- `≥1024px main { padding-bottom: 82px !important }` continua valendo; a status bar fica acima dos launchers globais (ver screenshot desktop).
- `src/orbidoc-motion.css` aplica animação de entrada em `main > div > *` — o editor é o único filho, então há uma única animação.

---

## 8. Funcionalidades preservadas (inventário)

| Área | Como funciona agora | Onde |
|------|---------------------|------|
| **Auto-save** | Debounce 550 ms → `localStorage['orbidoc_document_v4_{id}'] = { html, title, updatedAt }`, `localStorage['orbidoc_document_page_v1_{id}'] = pageSetup`, `onProjectChange({...project, title, content, previewSnippet, updatedAt})`; indicador "Salvo HH:MM" | context bar |
| **Restauração** | Estado inicial lê o rascunho local; se não houver, usa `project.content`; se vazio, `EMPTY_DOCUMENT` | montagem |
| **Modelos** | Menu "Modelos" → `applyTemplate(key)` com confirmação se houver conteúdo | context bar |
| **Importar** | DOCX via `mammoth` (import dinâmico; imagens embutidas como Data URL), HTML via `DOMParser`, TXT/MD via `markdownishTextToHtml`; título vira o nome do arquivo | context bar |
| **Exportar** | DOCX (`richHtmlToDocxBlob`), PDF (`convertFile(File, 'pdf')`), HTML (documento completo com estilos), TXT (`richHtmlToText`); cada exportação registra `onSaveToHistory({type:'word', …, tags:['Documento', FORMATO]})` | menu Exportar |
| **Imprimir** | iframe isolado com `srcdoc` (+ `@page { size: A4/letter; margin: 12/19/25mm }`), remove-se em `afterprint` ou 60 s; no runtime nativo Android orienta usar Exportar → PDF | menu Exportar |
| **Nexus AI** | `sendToVercel(engineProvider, engineModel, [system: instrução, user: texto])`; resposta sanitizada (`sanitizeRichHtml`), cercas ```html removidas; erro se vazia | menu Nexus AI |
| **Page setup** | Tamanho (A4 794×1123 / Carta 816×1056 px), margens (42/70/96 px), espaçamento (1,2/1,5/2,0); persistido por projeto | status bar |
| **Undo/Redo** | `document.execCommand('undo'/'redo')` | toolbar |
| **Listas / recuo** | `insertUnorderedList`, `insertOrderedList`, `outdent`, `indent` (+ CSS de marcadores restaurado) | toolbar |
| **Tabela** | `insertTable` com prompts de linhas (1–30) e colunas (1–12), primeira linha como `<th>` | toolbar |
| **Imagem** | `insertImage` (≤ 15 MB, `<figure><img><figcaption>`) | toolbar |
| **Link** | `insertLink` com validação de protocolo | toolbar |
| **Cores** | `foreColor` e `hiliteColor` via `<input type="color">` | toolbar |
| **Fonte / tamanho** | `fontName` (lista `OFFICE_FONTS`), `applyFontSize` (px reais) | toolbar |
| **Sanitização** | `sanitizeRichHtml` em toda entrada/saída; `normalizeLegacyFormatting` converte `<font>` em `<span>` | núcleo |
| **`.orbidoc-rich-editor`** | mantida no `contentEditable`; `DocumentFindReplaceBar` e `DocumentProPanel` continuam achando o editor via `document.querySelector('.orbidoc-rich-editor')` e disparando `InputEvent('input')` para acionar o auto-save | folha |
| **`.orbidoc-page`** | mantida (regras de `index.css`: largura 210 mm, `@media print` mostra só a folha, mobile 100 %) | folha |
| **Localizar/Substituir** | mesmo componente, agora no drawer (`embedded`) | drawer |
| **Documento Pro** | cabeçalho/rodapé, comentar seleção, nota de rodapé, sumário, auditoria de acessibilidade — mesmo componente, aberto por padrão no drawer | drawer |
| **Studio Pro** | criar versão, backup portátil, atalhos — mesmo componente em `layout="stack"` | drawer |

---

## 9. Atalhos, acessibilidade e comportamento por dispositivo

### Atalhos

| Atalho | Ação |
|--------|------|
| `Ctrl/Cmd + H` | abre drawer e foca Localizar (seleciona o texto do campo) |
| `Esc` | fecha menu aberto; se não houver menu, fecha o drawer |
| `Enter` na busca da status bar | pula para a próxima ocorrência na folha |
| `Enter` no campo Localizar do drawer | `findNext` (comportamento original do componente) |
| `Ctrl/Cmd + Z / Y` | undo/redo nativos do `contentEditable` |

### Acessibilidade

- Menus: `aria-haspopup="menu"`, `aria-expanded`, itens `role="menuitem"`, separador `role="separator"`.
- Drawer: `role="complementary"` (inline) ou `role="dialog" aria-modal="true"` (overlay), `aria-label="Ferramentas avançadas"`; foco entra no diálogo ao abrir; botão de fechar com `aria-label`.
- Todos os `<select>`/inputs têm `aria-label`; botões de ícone têm `title` e/ou `aria-label`; ícones decorativos com `aria-hidden`.
- Backdrop é um `<button aria-label="Fechar ferramentas avançadas">`, então é operável por teclado.
- Contraste: texto secundário em `var(--orbit-muted)`, botões primários em `#3157F6` (Orbital Azure).

### Dispositivo / plataforma

| Contexto | Comportamento |
|----------|---------------|
| Desktop (≥1024) | drawer inline 360 px; toolbar em 2 linhas; FAB no canto do canvas |
| Tablet (640–1023) | drawer overlay ≤ 400 px; toolbar rola horizontalmente; rótulos dos botões visíveis |
| Celular (<640) | context bar só com ícones (título ainda visível), status bar rola; drawer overlay em largura total |
| Teclado virtual aberto (`orbidoc:keyboard-visibility`) | FAB oculto |
| Runtime nativo Android | "Imprimir" orienta a exportar PDF |
| Modo escuro | superfícies/bordas via tokens; folha permanece branca |

---

## 10. Constantes, chaves de armazenamento e contratos

```ts
EMPTY_DOCUMENT   = '<h1>Novo documento</h1><p>Comece a escrever aqui.</p>'
PAGE_WIDTH       = { a4: 794, letter: 816 }        // px @96dpi
PAGE_HEIGHT      = { a4: 1123, letter: 1056 }
MARGINS          = { narrow: 42, normal: 70, wide: 96 }   // px na tela
PRINT_MARGINS_MM = { narrow: 12, normal: 19, wide: 25 }   // @page na impressão
ZOOM_STEPS       = [50, 75, 90, 100, 110, 125, 150, 200]
WIDE_LAYOUT_QUERY= '(min-width: 1024px)'
EXPORT_OPTIONS   = docx | pdf | html | txt
AI_ACTIONS       = improve | summarize | expand   (rótulo, dica, instrução de sistema)
TEMPLATE_OPTIONS = report | school | minutes | proposal
```

Chaves de `localStorage` (inalteradas em relação à versão anterior — rascunhos existentes continuam válidos):

- `orbidoc_document_v4_{project.id}` → `{ html, title, updatedAt }`
- `orbidoc_document_page_v1_{project.id}` → `{ size, margins, lineHeight }`

Eventos/atributos consumidos:

- `window` `orbidoc:keyboard-visibility` (`detail.open: boolean`) — emitido por `NativeViewportAgent`.
- `document.documentElement.dataset.orbidocKeyboard` (`'open'`) — estado inicial.

Contratos de props novos (todos opcionais e retro-compatíveis):

| Componente | Prop | Padrão | Efeito |
|------------|------|--------|--------|
| `DocumentEditorStudio` | `advancedTools?: ReactNode` | `undefined` | renderiza FAB + drawer com esse conteúdo |
| `DocumentFindReplaceBar` | `embedded?: boolean` | `false` | sempre aberto, vertical, sem listener global |
| `DocumentProPanel` | `defaultOpen?: boolean` | `false` | estado inicial aberto |
| `StudioPowerBar` | `layout?: 'bar' \| 'stack'` | `'bar'` | empilha título e botões |

---

## 11. Verificação executada

Ambiente: Node + npm (o `bun` não está disponível no sandbox; os scripts do `package.json` foram executados com `npx`/`node`).

| Verificação | Comando | Resultado |
|-------------|---------|-----------|
| Lint de fontes | `npm run lint` (`scripts/lint-source.mjs`) | ✅ 146 arquivos |
| Typecheck | `npx tsc --noEmit` | ✅ sem erros |
| Testes | `npx tsx --test tests/*.test.ts` | ✅ 80/80 (2 suítes) |
| Build completo | `npm run build` (brand assets → assetlinks → `vite build` → account-deletion → PWA manifest → esbuild server) | ✅ "built in 21.02s", 51 entradas no precache |
| Marca | `node scripts/check-orbidoc-brand.mjs` | ✅ nenhuma referência legada |
| UI mobile | `node scripts/verify-mobile-ui.mjs` | ✅ "Orbit UI audit OK" |
| Nexus AI | `npm run verify:nexus` | ✅ |

Baseline antes das mudanças (para comparação): lint ✅, typecheck ✅, testes 80/80 ✅ — ou seja, nada regrediu e nenhum teste precisou ser alterado.

---

## 12. Smoke test visual (Chromium headless)

Como os downloads de navegador do Playwright/Puppeteer estavam bloqueados no sandbox, foi usado `@sparticuz/chromium@131` + `puppeteer-core@23` contra o dev server Vite (`npx vite --host 0.0.0.0 --port 3000`).

Preparação do estado (via `localStorage` antes da navegação):

- `orbidoc_onboarding_v1 = 'done'` (o valor `'true'` **não** dispensa o onboarding — a checagem é `=== 'done'`)
- `orbit_auth_entry_v1 = 'continue-local'` (dispensa a tela de login)
- `orbidoc_projects_v1` com um projeto `type: 'word'`, id `doc-test-1`, título "Relatório trimestral" e ~376 palavras de conteúdo (para forçar rolagem)
- `orbit_theme_v1` para o cenário escuro

Roteiro por viewport (desktop 1440×900 claro e escuro, tablet 820×1100, celular 390×844):

1. Abrir "Meus arquivos" → clicar no cartão do projeto → capturar editor.
2. Clicar no FAB → capturar drawer → `Esc`.
3. `Ctrl+H` → verificar `document.activeElement` = `[data-orbidoc-find-input]` → capturar.
4. Abrir menu Nexus AI → capturar; abrir menu Modelos → capturar.
5. Rolar o canvas 600 px → capturar (toolbar e status bar devem permanecer).

Resultados:

| Cenário | Editor renderiza | FAB | Drawer abre | Esc fecha | Ctrl+H foca busca | Erros de página |
|---------|------------------|-----|-------------|-----------|-------------------|-----------------|
| desktop | ✅ | ✅ | ✅ inline 360 px | ✅ | ✅ `true` | nenhum¹ |
| desktop-dark | ✅ | ✅ | ✅ | ✅ | ✅ `true` | nenhum¹ |
| tablet | ✅ | ✅ | ✅ overlay 400 px | ✅ | ✅ `true` | nenhum¹ |
| mobile | ✅ | ✅ | ✅ overlay largura total | ✅ | ✅ `true` | nenhum¹ |

¹ Apenas `ERR_CONNECTION_CLOSED` para recursos externos (fontes/serviços) bloqueados pela rede do sandbox — não relacionados ao editor.

Observações visuais confirmadas nas capturas:

- Desktop: context bar em uma linha; toolbar em duas linhas; folha centralizada com sombra; status bar completa; FAB no canto inferior direito acima da status bar; launchers globais do shell abaixo, sem sobreposição.
- Drawer desktop: folha permanece visível e centralizada na área restante; painéis Localizar / Documento Pro / Studio Pro empilhados com scroll próprio.
- Menu Nexus AI e Modelos abrem por cima da toolbar/folha (`z-40`), com dicas legíveis.
- Ao rolar: toolbar e status bar fixas; só a folha se move.
- Tablet/celular: drawer sobrepõe a folha com backdrop escurecido, sem cobrir o header do shell nem a bottom nav.
- Celular: barra de contexto com título legível + ícones; marcadores/numeração das listas visíveis após a correção de CSS.

> As capturas foram geradas em `/tmp/shots/` (efêmero, fora do repositório) e não foram versionadas. O roteiro pode ser refeito com Playwright seguindo os passos acima.

---

## 13. Problemas encontrados e correções durante o trabalho

| # | Problema | Causa | Correção |
|---|----------|-------|----------|
| 1 | Editor crescia com o conteúdo (1425–2687 px) e o `<main>` rolava | O wrapper `max-w-[1520px] mx-auto` do AppV5 não propagava altura, quebrando a cadeia `h-full` | `h-full min-h-0` no wrapper apenas quando `view === 'word'` |
| 2 | Listas sem marcadores/numeração na folha | Preflight do Tailwind 4 remove `list-style` | 3 regras em `index.css` sob `.orbidoc-rich-editor` |
| 3 | Botões "Substituir tudo" quebrando em duas linhas no drawer (360 px) | Grade 3 colunas estreita demais | Layout embutido reorganizado: linha "Diferenciar maiúsculas + Próxima" e grade 2 colunas para Substituir/Substituir tudo; `whitespace-nowrap` |
| 4 | Context bar no celular sem espaço para o título | `<select>` de modelos + rótulos ocupavam a linha | Modelos virou menu com ícone; rótulos ocultos em `< sm`; título com `min-w-[6rem]` |
| 5 | Toolbar poluída com botões de IA (Melhorar/Resumir/Expandir) misturados à formatação | v1 da reescrita | IA consolidada no menu "Nexus AI" da context bar (com dicas por ação); toolbar só formatação |
| 6 | Onboarding/login cobrindo o editor no smoke test | Chaves de `localStorage` semeadas com valores errados | `orbidoc_onboarding_v1='done'`, `orbit_auth_entry_v1='continue-local'` |
| 7 | Chromium headless indisponível (downloads bloqueados) | Rede do sandbox | `@sparticuz/chromium` via npm + `LD_LIBRARY_PATH` com as libs `al2/al2023` extraídas |

---

## 14. Decisões de design e alternativas descartadas

- **Drawer dentro do editor vs. sheet global do shell.** Optou-se por manter o drawer dentro de `.orbidoc-document-studio` (posicionamento `absolute`) para não depender da escala de z-index do shell (toolbar 20 / header 30 / bottom-nav 40 / dropdown 50 / popover 60 / sheet 70 / dialog 80 / toast 90) e para que header, sidebar e bottom nav continuem acessíveis com o drawer aberto.
- **Coluna inline em desktop** em vez de overlay: com ≥1024 px há espaço para folha (~794 px) + 360 px, e o usuário consegue localizar/substituir vendo o resultado ao vivo, como no Google Docs.
- **Ctrl+H tratado pelo host.** O `DocumentFindReplaceBar` em modo `embedded` não registra atalhos; o `DocumentEditorStudio` centraliza Ctrl+H/Esc, evitando dois listeners disputando o mesmo evento.
- **Um único estado `menu`** para Modelos/Nexus AI/Exportar garante que apenas um popover fique aberto e simplifica o fechamento por clique fora.
- **Zoom em passos discretos** (em vez de slider) para caber na status bar e ser operável por toque.
- **Sem cap de altura via CSS calc.** A restrição explícita proibia `min-h-[calc(100dvh-…)]`; a solução correta foi completar a cadeia flex no AppV5.
- **`overflow-clip`** no contêiner em vez de `overflow-hidden`, pois `hidden` cria um contexto de rolagem que poderia capturar `scrollIntoView` da busca.
- **Manter `document.execCommand`.** Trocar por um motor de rich text (ProseMirror/TipTap) estava fora do escopo; o objetivo era hierarquia visual/estrutura, não o motor de edição.

---

## 15. Como commitar e publicar

As alterações estão salvas na árvore de trabalho da branch `arena/01a08ecd-orbidoc` (não commitadas neste ambiente). O `package-lock.json` gerado pelo `npm install` **não** deve entrar no commit (o projeto usa `bun.lock`).

```bash
git add src/AppV5.tsx src/index.css \
        src/components/DocumentEditor.tsx \
        src/components/DocumentEditorStudio.tsx \
        src/components/DocumentFindReplaceBar.tsx \
        src/components/DocumentProPanel.tsx \
        src/components/StudioPowerBar.tsx \
        docs/DOCUMENT-EDITOR-REFACTOR-V2.md

git commit -m "refactor(document): Google Docs hierarchy — page protagonist, drawer for advanced tools" -m "
- DocumentEditorStudio: thin context bar (title, saved state, Modelos/Importar/Nexus AI/Exportar menus),
  sticky formatting toolbar, central white sheet, bottom status bar (words, search, page setup, zoom).
- Advanced tools (Localizar/Substituir, Documento Pro, Studio Pro) leave the vertical flow: they live in
  a drawer opened by the floating 'Avançado' button (inline column ≥1024px, overlay below). Ctrl+H opens
  the drawer and focuses the find input; Esc closes it. FAB hides while the soft keyboard is open.
- No rounded-3xl card, no min-h-[calc(100dvh-…)]: h-full/min-h-0 flex chain (AppV5 main → wrapper → studio)
  so the sheet scrolls inside the editor instead of stretching the shell.
- DocumentEditor becomes a thin composer passing the tools as advancedTools.
- FindReplaceBar gains an 'embedded' mode, ProPanel a 'defaultOpen' prop, StudioPowerBar a 'stack' layout.
- index.css: restore list markers inside .orbidoc-rich-editor (Tailwind preflight reset)."

git push origin arena/01a08ecd-orbidoc
```

> **Push:** a integração GitHub usada neste ambiente retorna **403** ao escrever em `KassiusPrime/OrbiDoc` (precisa da permissão *Contents: Read and write*). Depois de ajustar a permissão — ou a partir de uma máquina com acesso — basta executar o `git push` acima e abrir o PR de `arena/01a08ecd-orbidoc` para `main`.

---

## 16. Checklist de QA manual

**Layout**
- [ ] Abrir um documento: nenhuma barra além de context bar + toolbar acima da folha.
- [ ] Rolar a folha: toolbar e status bar permanecem visíveis; o `<main>` não rola.
- [ ] Redimensionar a janela de 1440 → 390 px: nada quebra em duas linhas na context bar; toolbar rola horizontalmente.
- [ ] Modo escuro: superfícies escuras, folha branca, texto legível nos menus.

**Drawer**
- [ ] Clique em "Avançado": abre coluna (desktop) / overlay (mobile); FAB some.
- [ ] `Ctrl+H`: drawer abre com o cursor no campo Localizar; digitar + Enter navega pelas ocorrências.
- [ ] `Esc`, X e backdrop fecham; FAB volta.
- [ ] Localizar/Substituir, "Aplicar ao documento" (cabeçalho/rodapé), "Comentar seleção", "Gerar sumário" e "Criar versão" continuam alterando a folha e disparando o auto-save ("Salvo HH:MM" atualiza).

**Funcionalidades**
- [ ] Modelos → confirmar substituição → conteúdo aplicado.
- [ ] Importar `.docx`, `.html`, `.txt`, `.md`.
- [ ] Exportar DOCX / PDF / HTML / TXT; entrada aparece no Histórico.
- [ ] Imprimir: apenas a folha, no tamanho/margem escolhidos.
- [ ] Nexus AI: Melhorar / Resumir / Expandir substituem o conteúdo; erro amigável sem texto.
- [ ] Toolbar: negrito, listas (com marcadores visíveis), tabela, imagem, link, cores, tamanho de fonte, limpar formatação.
- [ ] Page setup: A4 ↔ Carta, margens e espaçamento persistem ao recarregar.
- [ ] Zoom − / + / clique em "100 %".
- [ ] Recarregar a página: rascunho e título restaurados do `localStorage`.

**Regressão em outros editores**
- [ ] Planilha, Apresentação e Design mostram o `StudioPowerBar` como antes (layout `bar`).

---

## 17. Riscos, limitações e próximos passos

- **Motor de edição** continua sendo `contentEditable` + `execCommand` (obsoleto porém funcional nos navegadores atuais). Uma migração futura para ProseMirror/TipTap pode reaproveitar toda a casca (context bar, toolbar, drawer, status bar) sem alterações estruturais.
- **Contagem de páginas** é estimativa por palavras (520/pág.), não paginação real.
- **`WordEditor.tsx` (legado)** ainda envolve o `DocumentEditor` em sua própria estrutura; se ele for usado fora do `main` do AppV5, a cadeia `h-full` depende do contêiner dele.
- **Capturas do smoke test** não foram versionadas (eram temporárias). Vale adicionar um teste Playwright em CI seguindo o roteiro da seção 12 se o time quiser proteger essa hierarquia contra regressões.
- **Sugestões de evolução:** contador de ocorrências destacando todas as correspondências na folha; ocultar automaticamente a toolbar em modo "foco"; lembrar o estado aberto/fechado do drawer por dispositivo.

---

## Apêndice A — Diff resumido

### `src/AppV5.tsx`
```diff
-<div className={view === 'chat' || view === 'ai' || view === 'compare' ? '' : 'max-w-[1520px] mx-auto'}>{renderContent()}</div>
+<div className={view === 'chat' || view === 'ai' || view === 'compare' ? '' : `max-w-[1520px] mx-auto${view === 'word' ? ' h-full min-h-0' : ''}`}>{renderContent()}</div>
```

### `src/index.css`
```diff
 .orbidoc-rich-editor ul,
 .orbidoc-rich-editor ol { margin: 0.45em 0 0.9em; padding-left: 1.6em; }
+.orbidoc-rich-editor ul { list-style: disc outside; }
+.orbidoc-rich-editor ol { list-style: decimal outside; }
+.orbidoc-rich-editor ul ul { list-style-type: circle; }
```

### `src/components/DocumentProPanel.tsx`
```diff
-type Props = { showNotification?: … };
+type Props = { showNotification?: …; defaultOpen?: boolean };
-export const DocumentProPanel: React.FC<Props> = ({ showNotification = () => {} }) => {
-  const [open, setOpen] = useState(false);
+export const DocumentProPanel: React.FC<Props> = ({ showNotification = () => {}, defaultOpen = false }) => {
+  const [open, setOpen] = useState(defaultOpen);
-  return <section className="mb-3 rounded-2xl …">
+  return <section className="rounded-2xl …">
-    {open && <div className="p-3 sm:p-4 border-t … grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
+    {open && <div className="p-3 border-t … grid grid-cols-1 gap-3">
```

### `src/components/StudioPowerBar.tsx`
```diff
-… showNotification?: …}> = ({ project, kind, showNotification = () => {} }) => {
+… showNotification?: …; layout?: 'bar' | 'stack' }> = ({ project, kind, showNotification = () => {}, layout = 'bar' }) => {
-  return <div className="orbidoc-studio-powerbar mb-2 rounded-2xl …"><div className="min-w-0 flex-1">
+  return <div className={`orbidoc-studio-powerbar rounded-2xl … ${layout === 'stack' ? '' : 'mb-2'}`}><div className={layout === 'stack' ? 'w-full' : 'min-w-0 flex-1'}>
```

### `src/components/DocumentFindReplaceBar.tsx`
```diff
+type Props = { showNotification?: …; embedded?: boolean };
-export const DocumentFindReplaceBar: React.FC<{…}> = ({ showNotification = () => {} }) => {
-  const [open, setOpen] = useState(false);
+export const DocumentFindReplaceBar: React.FC<Props> = ({ showNotification = () => {}, embedded = false }) => {
+  const [open, setOpen] = useState(embedded);
   useEffect(() => {
+    if (embedded) return undefined;
     … listener Ctrl+H / Esc …
-  }, [open]);
+  }, [open, embedded]);
+  const findField = <… input autoFocus={!embedded} data-orbidoc-find-input="true" aria-label="Localizar" …/>;
+  const replaceField / caseToggle / nextButton / replaceButton / replaceAllButton = …;
+  if (embedded) {
+    return <section aria-label="Localizar e substituir" className="rounded-2xl border … p-3 space-y-2">
+      <div className="flex items-center gap-2">… Localizar e substituir … Ctrl+H</div>
+      {findField}{replaceField}
+      <div className="flex flex-wrap items-center gap-2">{caseToggle}{nextButton}</div>
+      <div className="grid grid-cols-2 gap-2">{replaceButton}{replaceAllButton}</div>
+    </section>;
+  }
   return <div className="mb-2 … flex flex-col lg:flex-row …">{findField}{replaceField}{caseToggle}{nextButton}{replaceButton}{replaceAllButton}<button …X…/></div>;
```

### `src/components/DocumentEditor.tsx`
```diff
-export const DocumentEditor = (props) => <div><StudioPowerBar …/><DocumentFindReplaceBar …/><DocumentProPanel …/><DocumentEditorStudio {...props} /></div>;
+export const DocumentEditor = (props) => (
+  <DocumentEditorStudio {...props} advancedTools={(<>
+    <DocumentFindReplaceBar embedded showNotification={props.showNotification} />
+    <DocumentProPanel defaultOpen showNotification={props.showNotification} />
+    <StudioPowerBar project={props.project} kind="word" layout="stack" showNotification={props.showNotification} />
+  </>)} />
+);
```

### `src/components/DocumentEditorStudio.tsx`
Reescrito (ver seções 4.1, 5 e 6). Esqueleto do JSX retornado:

```tsx
<div className="orbidoc-document-studio relative h-full min-h-0 flex flex-col overflow-clip rounded-[12px] lg:rounded-[16px] border …">
  <div className="h-12 shrink-0 … border-b">            {/* context bar */}
    <FileText/> <input aria-label="Nome do documento"/> <span>Salvo HH:MM</span>
    <Menu Modelos/> <Importar/> <Menu Nexus AI/> <Menu Exportar/>
  </div>
  <OrbitToolbar label="Formatação do documento" compact className="sticky top-0 z-20 shrink-0 lg:flex-wrap border-b …">
    {/* estilo · fonte · tamanho │ undo · redo │ B I U S · cores │ alinhamento │ listas · recuo │ link · tabela · hr · imagem · limpar */}
  </OrbitToolbar>
  <div className="relative flex-1 min-h-0 flex">
    <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
      <div className="orbidoc-editor-canvas flex-1 min-h-0 overflow-auto overscroll-contain …">
        <div className="orbidoc-page mx-auto bg-white …" style={{ width, minHeight, padding, zoom }} onMouseDown={focusPageEnd}>
          <div ref={editorRef} contentEditable className="orbidoc-rich-editor outline-none text-[15px]" …/>
        </div>
      </div>
      {showFab && <button className="orbidoc-advanced-fab absolute right-3 bottom-3 …">Avançado</button>}
    </div>
    {showDrawer && wideLayout ? drawerPanel : null}
  </div>
  <div className="min-h-9 shrink-0 pl-2 pr-16 sm:pl-3 lg:pr-3 … border-t">   {/* status bar */}
    palavras · caracteres · pág. · [busca] · ocorrências · … · A4/Carta · margens · espaçamento · [− zoom% +]
  </div>
  {showDrawer && !wideLayout ? (
    <div className="absolute inset-0 z-30 flex justify-end">
      <button aria-label="Fechar ferramentas avançadas" className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"/>
      {drawerPanel}
    </div>
  ) : null}
</div>
```

---

## Apêndice B — Mapa de classes/ids para automação

| Seletor | Elemento |
|---------|----------|
| `.orbidoc-document-studio` | contêiner raiz do editor |
| `.orbidoc-editor-canvas` | área rolável que contém a folha |
| `.orbidoc-page` | folha branca (largura/margens/zoom inline) |
| `.orbidoc-rich-editor` | `contentEditable` (consultado por FindReplace e ProPanel) |
| `.orbidoc-advanced-fab` | botão flutuante "Avançado" |
| `#orbidoc-advanced-drawer` | painel do drawer (inline ou overlay) |
| `[data-orbidoc-find-input]` | campo "Localizar" dentro do drawer (alvo do Ctrl+H) |
| `button[aria-label="Fechar ferramentas avançadas"]` | X do drawer **e** backdrop (dois elementos no overlay) |
| `button[aria-haspopup="menu"]` (títulos "Modelos de documento", "Nexus AI · …", texto "Exportar") | gatilhos dos menus da context bar |
| `[role="menu"][aria-label="Modelos de documento" \| "Ações do Nexus AI" \| "Formatos de exportação"]` | popovers |
| `input[aria-label="Nome do documento"]` | título |
| `input[aria-label="Buscar no documento"]` | busca rápida da status bar |
| `select[aria-label="Tamanho da página" \| "Margens" \| "Espaçamento entre linhas"]` | page setup |
| `button[aria-label="Diminuir zoom" \| "Aumentar zoom"]` | zoom |
| `.orbidoc-studio-powerbar` | Studio Pro (dentro do drawer) |
