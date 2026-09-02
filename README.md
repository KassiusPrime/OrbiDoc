# OrbiDoc
Processador de Documentos, OCR, Tradutor e Conversor de Áudio

**Workspace local-first** para documentos, planilhas, apresentações, design, PDF, scanner, OCR e conversão de arquivos — no navegador (PWA) e no Android (Capacitor).

## 🌐 IA Web gratuita para todos

O **OrbiDoc Web** (`orbidoc/web-free`) é o motor de pesquisa na internet do Orbi AI Studio:

- **Sem chave de API e sem conta**: busca keyless no DuckDuckGo funciona para qualquer pessoa, em qualquer implantação.
- **Respostas com fontes**: quando há credencial do Vercel AI Gateway (automática via OIDC na Vercel), a resposta é sintetizada pelo modelo gratuito `inclusionai/ling-3.0-flash-free`; sem credencial, o motor devolve os resultados estruturados com trechos e links das fontes.
- **Sem fallback oculto**: provedores diretos (Gemini, Groq Compound, OpenRouter) continuam disponíveis e respeitados quando configurados — a escolha do motor é sempre sua.

## 🧰 Funcionalidades

- Editores de documentos, planilhas, apresentações e design (locais, offline)
- OCR e leitura de PDF (Tesseract.js + pdf.js)
- Conversão de arquivos e utilitários locais
- Orbi AI Studio: Copiloto, Pesquisa Web (gratuita) e Diagnóstico de provedores
- Conta opcional (Firebase) com sincronização de preferências e histórico local

## 🚀 Executando

```bash
bun install          # ou npm install
npm run dev          # servidor em http://localhost:3000
npm run check        # lint + typecheck + testes + build + verificações
```

Variáveis de ambiente opcionais: veja `.env.example` (nenhuma é obrigatória para a Pesquisa Web gratuita).
