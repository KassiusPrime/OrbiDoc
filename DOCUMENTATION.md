# 📚 OrbiDoc - Documentação Completa

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Estrutura do Projeto](#estrutura-do-projeto)
3. [Arquivos de Configuração](#arquivos-de-configuração)
4. [Código Fonte](#código-fonte)
5. [Funcionalidades](#funcionalidades)
6. [Como Executar](#como-executar)
7. [Dependências](#dependências)

---

## 🎯 Visão Geral

**OrbiDoc** é uma aplicação web PWA (Progressive Web App) desenvolvida com React, TypeScript, Vite e Tailwind CSS. Oferece ferramentas inteligentes para processamento de documentos:

- 📄 **OCR (Extração de Texto)** - Extrai texto de imagens usando Tesseract.js
- 🤖 **IA de Texto** - Tradução, resumo, correção gramatical e melhoria de texto
- 🎨 **IA Visual** - Geração de imagens com Pollinations AI
- 🔊 **Áudio** - Text-to-Speech (TTS) e Speech-to-Text (STT)
- 📤 **Exportação** - TXT, DOCX e PDF

---

## 📁 Estrutura do Projeto

```
orbidoc/
├── public/
│   └── logo.png              # Ícone do PWA (192x192 / 512x512)
├── src/
│   ├── lib/
│   │   └── utils.ts          # Utilitários de extração de texto (OCR)
│   ├── utils/
│   │   └── cn.ts             # Utilitário para classes CSS (clsx + tailwind-merge)
│   ├── App.tsx               # Componente principal da aplicação
│   ├── index.css             # Estilos globais e animações
│   └── main.tsx              # Ponto de entrada React
├── index.html                # HTML principal
├── package.json              # Dependências e scripts
├── tsconfig.json             # Configuração TypeScript
├── vite.config.ts            # Configuração Vite + PWA
└── DOCUMENTATION.md          # Este arquivo
```

---

## ⚙️ Arquivos de Configuração

### 📄 `package.json`

**Propósito:** Define metadados do projeto, scripts e dependências.

| Campo | Descrição |
|-------|-----------|
| `name` | Nome do projeto |
| `scripts.dev` | Inicia servidor de desenvolvimento |
| `scripts.build` | Compila para produção |
| `scripts.preview` | Visualiza build de produção |

**Dependências Principais:**
- `react` / `react-dom` - Framework UI
- `tesseract.js` - OCR para extração de texto de imagens
- `docx` - Geração de arquivos Word
- `jspdf` - Geração de arquivos PDF
- `file-saver` - Download de arquivos
- `lucide-react` - Biblioteca de ícones
- `vite-plugin-pwa` - Suporte a PWA

---

### 📄 `tsconfig.json`

**Propósito:** Configuração do compilador TypeScript.

| Opção | Valor | Descrição |
|-------|-------|-----------|
| `target` | ES2020 | Versão do JavaScript de saída |
| `module` | ESNext | Sistema de módulos |
| `jsx` | react-jsx | Modo JSX para React 17+ |
| `strict` | true | Verificações rigorosas de tipo |
| `moduleResolution` | bundler | Resolução de módulos para Vite |
| `paths` | `@/*` → `src/*` | Alias de importação |

---

### 📄 `vite.config.ts`

**Propósito:** Configuração do bundler Vite e plugins.

**Plugins:**
1. `@vitejs/plugin-react` - Suporte a React com Fast Refresh
2. `@tailwindcss/vite` - Integração Tailwind CSS 4
3. `vite-plugin-pwa` - Progressive Web App

**Configuração PWA:**
- `registerType: autoUpdate` - Atualiza automaticamente o service worker
- `workbox` - Cache de modelos HuggingFace para uso offline
- `manifest` - Configuração do Web App Manifest

---

### 📄 `index.html`

**Propósito:** Documento HTML principal que carrega a aplicação.

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#6366f1" />
    <link rel="icon" type="image/png" href="/logo.png" />
    <title>OrbiDoc</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 💻 Código Fonte

### 📄 `src/main.tsx`

**Propósito:** Ponto de entrada da aplicação React.

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

---

### 📄 `src/index.css`

**Propósito:** Estilos globais e animações customizadas.

**Animações:**
- `loading` - Barra de progresso do splash screen
- `slideIn` - Entrada das notificações

---

### 📄 `src/utils/cn.ts`

**Propósito:** Utilitário para combinar classes CSS condicionalmente.

```tsx
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Uso:**
```tsx
<div className={cn("base-class", condition && "conditional-class")} />
```

---

### 📄 `src/lib/utils.ts`

**Propósito:** Funções de extração de texto de arquivos.

**Funções:**

| Função | Descrição |
|--------|-----------|
| `extractTextFromFile()` | Detecta tipo de arquivo e extrai texto |
| `extractTextFromImage()` | Usa Tesseract.js para OCR |
| `extractTextFromPdfAsImage()` | Tenta extrair texto de PDF |

**Formatos Suportados:**
- Imagens: PNG, JPG, JPEG, GIF, BMP, WEBP, TIFF
- Texto: TXT, MD, CSV, JSON, XML, HTML, CSS, JS, TS
- Documentos: PDF (básico)

---

### 📄 `src/App.tsx`

**Propósito:** Componente principal com toda a lógica da aplicação.

**Estados Principais:**

| Estado | Tipo | Descrição |
|--------|------|-----------|
| `activeTab` | TabType | Aba ativa (extract/ai/image/audio) |
| `extractedText` | string | Texto extraído via OCR |
| `aiText` | string | Texto de entrada para IA |
| `aiResult` | string | Resultado do processamento IA |
| `generatedImage` | string | URL da imagem gerada |
| `apiKey` | string | Chave de API (localStorage) |

**Funções Principais:**

| Função | Descrição |
|--------|-----------|
| `handleFileUpload()` | Processa upload de arquivos |
| `handleAiAction()` | Executa ação de IA (traduzir/resumir/etc) |
| `handleGenerateImage()` | Gera imagem via Pollinations |
| `handleTTS()` | Text-to-Speech |
| `handleSTT()` | Speech-to-Text |
| `exportAsTxt/Docx/Pdf()` | Exporta resultados |

---

## 🚀 Funcionalidades

### 1️⃣ Extração de Texto (OCR)

- Upload de imagens → Tesseract.js extrai texto
- Suporte a múltiplos idiomas (português + inglês)
- Barra de progresso em tempo real
- Edição do texto extraído

### 2️⃣ IA de Texto

| Ação | Descrição | Motor |
|------|-----------|-------|
| Traduzir | Traduz para idioma selecionado | Google (grátis) / OpenAI / Gemini / Groq |
| Resumir | Resume o texto mantendo pontos principais | OpenAI / Gemini / Groq |
| Gramática | Corrige erros gramaticais | OpenAI / Gemini / Groq |
| Melhorar | Melhora qualidade da escrita | OpenAI / Gemini / Groq |

### 3️⃣ IA Visual

- Geração de imagens via Pollinations AI
- Gratuito, sem necessidade de API key
- Download direto das imagens

### 4️⃣ Áudio

**Text-to-Speech (TTS):**
- Usa Web Speech API nativa
- Idioma: Português (pt-BR)

**Speech-to-Text (STT):**
- Reconhecimento de voz em tempo real
- Transcrição contínua

### 5️⃣ Exportação

- **TXT** - Arquivo de texto simples
- **DOCX** - Documento Microsoft Word
- **PDF** - Documento PDF

---

## 🔧 Como Executar

### Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

### Produção

```bash
# Compilar para produção
npm run build

# Visualizar build
npm run preview
```

---

## 📦 Dependências

### Produção

| Pacote | Versão | Uso |
|--------|--------|-----|
| react | 19.x | Framework UI |
| react-dom | 19.x | Renderização DOM |
| tesseract.js | 7.x | OCR |
| docx | 9.x | Geração DOCX |
| jspdf | 4.x | Geração PDF |
| file-saver | 2.x | Download de arquivos |
| lucide-react | 1.x | Ícones |
| clsx | 2.x | Classes condicionais |
| tailwind-merge | 3.x | Merge de classes Tailwind |

### Desenvolvimento

| Pacote | Versão | Uso |
|--------|--------|-----|
| vite | 7.x | Bundler |
| typescript | 5.x | Linguagem |
| tailwindcss | 4.x | CSS Framework |
| @vitejs/plugin-react | 5.x | Plugin React |
| vite-plugin-pwa | 1.x | PWA |

---

## 🔐 Configuração de APIs

### Google Translate
- ✅ Gratuito, não requer API key
- Usa endpoint público não-oficial

### OpenAI
- Requer API key
- Modelo: `gpt-3.5-turbo`
- [Obter API key](https://platform.openai.com/api-keys)

### Google Gemini
- Requer API key
- Modelo: `gemini-pro`
- [Obter API key](https://makersuite.google.com/app/apikey)

### Groq
- Requer API key
- Modelo: `llama3-8b-8192`
- [Obter API key](https://console.groq.com/keys)

### Pollinations AI
- ✅ Gratuito, não requer API key
- Geração de imagens via URL

---

## 📱 PWA

A aplicação é um PWA instalável com:

- ✅ Service Worker para cache offline
- ✅ Web App Manifest
- ✅ Ícones para instalação
- ✅ Atualização automática

Para instalar, acesse a aplicação no navegador e clique em "Instalar" ou "Adicionar à tela inicial".

---

## 🧩 Sistema de layout do workspace (Orbit Workspace UI)

Camada compartilhada que padroniza densidade, aproveitamento de espaço e
redimensionamento em todos os apps do workspace.

### Primitivos

| Arquivo | Papel |
| --- | --- |
| `src/components/orbit/OrbitResizable.tsx` | `OrbitResizablePane` (painel redimensionável e persistente), `OrbitResizeGrip` (alça isolada para colunas/linhas) e `useMediaQuery`. Sem dependências externas. |
| `src/components/orbit/OrbitEditorFrame.tsx` | Moldura única dos editores: barra densa de 40px, doca lateral de ferramentas e modo foco. |
| `src/orbit-workspace.css` | Tokens visuais das alças, grades de planilha, doca, régua e modo foco. |

### Comportamento das alças

- Arraste por ponteiro/toque (`setPointerCapture`, `touch-action: none`).
- Teclado: `←/→` ou `↑/↓` movem 16px, com `Shift` 64px; `Home`/`End` vão aos
  limites; `Enter`/`Espaço` restauram o padrão.
- Duplo clique restaura o tamanho padrão (nas colunas de planilha, ajusta ao
  conteúdo).
- Cada painel persiste seu tamanho em `localStorage` (`orbit_pane_<chave>`).
- Semântica ARIA de `separator` com `aria-valuemin/max/now`.

### Aproveitamento de espaço

- Editores e o Nexus AI são renderizados em modo *full bleed*: sem padding,
  sem `max-width` e sem scroll externo (`data-orbit-surface="editor"`).
- Modo foco (`Alt + Z`) esconde sidebar, header e bottom navigation.
- A sidebar é redimensionável (190–420px) e colapsa para um rail de ícones.


### Editor de documentos — hierarquia Google Docs (v2)

Estrutura de cima para baixo, sem barras empilhadas:

1. **Context bar** — ícone, título editável, "Salvo …", Modelos, Importar, **Avançado**, Imprimir e Exportar.
2. **Toolbar** — bloco, fonte, tamanho, undo/redo, negrito/itálico/sublinhado/tachado, cores,
   alinhamento, listas, recuo, link/tabela/imagem/linha, limpar formatação e o grupo violeta de IA
   (Melhorar · Resumir · Expandir). Rola na horizontal em telas estreitas.
3. **Página** — folha branca central com sombra suave em fundo neutro, A4/Carta, margens e zoom.
4. **Status bar** — palavras · páginas · caracteres, busca e configuração de página.

Ferramentas avançadas ficam em um **drawer lateral** (redimensionável e persistente no desktop,
tela cheia até `max-w-md` no mobile) com quatro abas:

| Aba | Conteúdo |
| --- | --- |
| Estrutura | `DocumentOutlinePane` — títulos navegáveis com filtro |
| Localizar | `DocumentFindReplaceBar` completo (Ctrl+H / Ctrl+F, Enter na busca da status bar) |
| Documento Pro | `DocumentProPanel` — cabeçalho/rodapé, comentários, notas, sumário e auditoria |
| Projeto | Versão restaurável, backup portátil, atalhos e modo foco (`Alt + Z`) |

Nada disso é montado acima da página: `DocumentEditor.tsx` é um shell mínimo que renderiza o
`DocumentEditorStudio` e o drawer. As ações de projeto (versão, backup, atalhos, foco) saíram para
`src/components/orbit/OrbitProjectTools.tsx`, compartilhado com os demais editores.

### Painéis por app

| App | Painéis redimensionáveis |
| --- | --- |
| Documentos | Drawer avançado (estrutura, busca, pro, projeto) |
| Planilhas | Colunas, linhas e painel de resumo do intervalo |
| Apresentações | Lista de slides + inspetor |
| Design | Biblioteca + inspetor |

---

## 📝 Licença

Projeto privado. Todos os direitos reservados.