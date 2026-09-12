# Orbit — Tokens de design (FASE 2)

Referência escrita única dos tokens. Implementação em `src/orbit-tokens.css`
(camada semântica) + `src/index.css` (marca e workspace).

**Regra:** componentes consomem tokens. Hex solto em componente novo é
violação, exceto para cores já providas por `OFFICE_FONTS`/temas de conteúdo.

---

## 1. Cor — intenção, não decoração

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--orbit-action` | `#2563eb` | `#60a5fa` | **Arquivo / ação primária** (exportar, salvar, importar) e links |
| `--orbit-action-hover` | `#1d4ed8` | `#93c5fd` | Hover do azul |
| `--orbit-action-muted` | `#eff6ff` | `#172554` | Fundo de chip/badge azul |
| `--orbit-ai` | `#7c3aed` | `#a78bfa` | **Somente IA** |
| `--orbit-ai-hover` | `#6d28d9` | `#c4b5fd` | Hover da IA |
| `--orbit-ai-muted` | `#ede9fe` | `#2e1065` | Fundo do grupo de IA |
| `--orbit-success` | `#059669` | `#34d399` | Salvo / ok |
| `--orbit-success-muted` | `#d1fae5` | `#064e3b` | Badge "Salvo" |
| `--orbit-danger` | `#dc2626` | `#f87171` | Erro / destrutivo |
| `--orbit-warning` | `#d97706` | `#fbbf24` | Avisos |

**Azul é arquivo. Violeta é IA. Nunca trocar os dois.**

### Superfícies

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--orbit-canvas` | `#e2e8f0` | `#0b1220` | Fundo atrás do protagonista |
| `--orbit-page` | `#ffffff` | `#0f172a` | Folha do documento |
| `--orbit-chrome` | `#f8fafc` | `#101827` | Faixas de ferramenta |
| `--orbit-border` | `#e2e8f0` | `#1e293b` | Divisórias |
| `--orbit-border-strong` | `#cbd5e1` | `#334155` | Inputs / foco suave |

### Compatibilidade (marca e workspace já existentes)

| Token | Uso |
|---|---|
| `--brand-primary` `#3157F6` | Identidade Orbit em logo, foco, destaques |
| `--workspace-bg` / `--workspace-surface` / `--workspace-surface-muted` | Fundos do shell |
| `--workspace-border` / `--workspace-text` / `--workspace-muted` | Chrome do workspace |

> Ação de arquivo usa `--orbit-action` (`blue-600`) nas superfícies; o
> `--brand-primary` fica reservado à identidade da marca. Isso evita o azul
> "quase igual" que aparenta inconsistência.

---

## 2. Espaço — escala 4

`--orbit-space-1` … `--orbit-space-12` = **4 · 8 · 12 · 16 · 24 · 32 · 48 px**

Gaps e paddings devem cair na escala. Valores como `px-2.5`, `p-2`, `gap-1.5`
já pertencem à escala (10px = 4+4+2 é tolerado em chrome denso de toolbar);
`gap-5`, `p-7`, `mt-9` em chrome são considerados "gap aleatório".

---

## 3. Radius

| Token | Valor | Uso |
|---|---|---|
| `--orbit-radius-control` | 8px (`rounded-md`) | Botões, inputs, chips |
| `--orbit-radius-panel` | 12px | Painéis, drawers, estado vazio |
| `--orbit-radius-pill` | 999px | Badges |

**Proibido como padrão de surface:** `rounded-3xl` + `shadow-xl`.

---

## 4. Elevação e foco

| Token | Uso |
|---|---|
| `--orbit-shadow-page` | Folha do documento |
| `--orbit-shadow-dropdown` | Menus e dropdowns |
| Foco | `outline: 2px solid var(--brand-primary)` (já global em `index.css`) |

---

## 5. Camadas (z-index)

| Token | Valor | Uso |
|---|---|---|
| `--orbit-z-toolbar` | 20 | Toolbar sticky |
| `--orbit-z-drawer` | 40 | Drawer avançado |
| `--orbit-z-modal` | 50 | Diálogos |
| `--orbit-z-toast` | 60 | Notificações |

> Overlays legados (modais de mídia, apresentação em tela cheia) usam
> `z-[120]`–`z-[160]`. São overlays de sistema, não chrome de produto — ficam
> fora desta escala e não devem ser copiados por superfícies novas.

---

## 6. Dimensões de chrome

| Token | Valor |
|---|---|
| `--orbit-h-contextbar` | 44px |
| `--orbit-h-toolbar` | 40px |
| `--orbit-h-statusbar` | 30px |
| `--orbit-w-sidebar` | 240px (range real: 190–420px, redimensionável) |
| `--orbit-w-sidebar-collapsed` | 56px |
| Página A4 @96dpi | 794 × 1123 px |
| Página Letter @96dpi | 816 × 1056 px |
| Margens narrow / normal / wide | 42 / 70 / 96 px |

---

## 7. Tipografia

| Papel | Valor |
|---|---|
| `font.ui` | Inter, system-ui, sans-serif (global em `index.css`) |
| `font.doc` | `OFFICE_FONTS` (escolha do usuário) — padrão Aptos/Calibri |
| `font.mono` | `ui-monospace, 'Courier New', monospace` |
| Escala de UI | 9–11px status/chrome denso · 12–13px labels · 14–15px conteúdo |
| Peso de chrome | 400 / 500 / 600 — **`font-black` proibido em toolbar** |
| Conteúdo | O documento pode ter hierarquia própria (H1 800) |

---

## 8. Classes canônicas

Já implementadas em `src/orbit-tokens.css`:

| Classe | Papel |
|---|---|
| `.orbit-contextbar` | Faixa de identidade do objeto (uma por surface) |
| `.orbit-surface-toolbar` | Fileira de ferramentas (uma por surface, sticky, scroll-x) |
| `.orbit-statusbar` | Rodapé de métricas (uma por surface) |
| `.orbit-empty-state` | Estado vazio calmo (sem card de marketing) |
| `.orbit-action` / `.orbit-ai-action` | Botões azul (arquivo) e violeta (IA) |
| `.orbit-chip` / `.orbit-drawer` / `.orbit-kbd` | Primitivos do workspace (`orbit-workspace.css`) |
| `--orbit-page` + `.orbit-doc-sheet` | Folha do documento |

---

## 9. Anti-tokens (proibidos em PR nova)

- Hex aleatório fora dos tokens
- `font-black` em labels de toolbar
- `rounded-3xl` + `shadow-xl` como container raiz de surface
- `min-h-[calc(100dvh-…)]` dentro de uma surface
- Segunda família de ícones na mesma barra
- Uma segunda sidebar interna por surface (exceto a tree do repo, que é
  parte do protagonista)
