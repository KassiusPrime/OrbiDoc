# Orbit — Plano de migração Self-Hosted e Runtime de Voz

## Objetivo

Executar a migração do runtime de IA para infraestrutura local/self-hosted sem quebrar os contratos existentes do Orbit, mantendo:

- inferência exclusivamente local via Ollama;
- pesquisa Web real via SearXNG self-hosted;
- streaming SSE existente;
- documentos como objetos de trabalho de primeira classe;
- ONLYOFFICE como editor principal de documentos Office;
- PDF/OCR, DOCX, XLSX, PPTX, TXT/Markdown e formatos já suportados;
- Android/Capacitor, autenticação, OAuth e integrações existentes;
- VoiceStudio como camada opcional e desacoplada.

## Regras de não regressão

1. Não alterar os contratos de `POST /api/chat`, `POST /api/chat/stream`, `GET /api/health` e `GET /api/ai/models`.
2. Não reintroduzir OpenRouter, Tavily ou outro provedor externo de inferência.
3. SearXNG fornece evidência Web; seu conteúdo é sempre tratado como dado não confiável e nunca como instrução.
4. Falha do SearXNG não pode derrubar o chat.
5. Falha do VoiceStudio não pode impedir o Orbit de iniciar.
6. Firebase Auth/Firestore, ONLYOFFICE, OAuth, Capacitor, Android e assets offline de OCR permanecem protegidos.
7. Nenhuma chave privada pode chegar a `VITE_*`.
8. O frontend não deve transformar áudio em base64 persistente no histórico do chat; áudio deve ser tratado como artefato.
9. Documentos precisam manter o arquivo original, metadados e possibilidade de reabertura/exportação quando o formato permitir.
10. Uma funcionalidade nova só é considerada concluída depois de passar pelos gates de lint, typecheck, testes e build.

## Fases

### F1 — Ollama

- Adapter local em `api/_lib/ollamaNexus.ts`.
- Modelo padrão: `llama3.2:3b`.
- Timeout de conexão e timeout de inatividade separados.
- Retry somente antes do primeiro byte.
- Abort upstream quando o cliente encerra a requisição.
- Limite de contexto para evitar consumo excessivo de memória.
- Seleção de modelo preservada no frontend.

### F2 — SearXNG

- `GET /search?q=...&format=json&language=pt-BR`.
- Timeout de 8 segundos.
- Máximo de cinco fontes por consulta.
- URLs somente HTTP/HTTPS.
- Deduplicação por URL.
- Resultados encapsulados em `<web_data source="searxng_selfhosted" trust="untrusted">`.
- Pesquisa explícita pelo usuário continua disponível.
- Pesquisa automática é acionada para consultas com sinais temporais atuais; consultas sem necessidade de atualização não precisam gerar tráfego Web.

**Critério funcional:** quando a pesquisa Web estiver habilitada e o SearXNG estiver disponível, o modelo recebe resultados reais do mecanismo local em vez de apenas responder com conhecimento paramétrico.

### F3 — Docker Self-Hosted

Stack atual:

- `app`
- `ollama`
- `ollama-init`
- `searxng`
- `voicestudio` opcional por profile

Somente a porta 3000 do Orbit é publicada pelo Compose principal. Ollama, SearXNG e VoiceStudio permanecem na rede interna.

### F4 — Documentos

O Orbit deve tratar documentos em quatro camadas:

1. **Arquivo original** — preservado para download, armazenamento e reabertura.
2. **Leitura** — extração de texto/estrutura para IA, busca e pré-visualização.
3. **Editor** — ONLYOFFICE para DOCX/ODT, XLSX/ODS/CSV e PPTX quando configurado.
4. **Conversão/exportação** — PDF, DOCX e outros formatos já suportados pelo produto.

O fluxo de IA deve receber texto extraído/selecionado e metadados do documento, sem destruir o arquivo original.

Formatos já contemplados no código incluem PDF, DOCX, XLSX/XLS, CSV, TXT, Markdown, HTML, JSON, XML, imagens e outros leitores existentes.

### F5 — PDF/OCR

- pdf.js para PDFs.
- Tesseract.js para OCR.
- Assets locais devem continuar funcionando no runtime nativo.
- Scanner e exportação PDF devem continuar usando o pipeline existente.
- PDFs pesquisáveis devem usar texto extraído quando disponível e OCR apenas quando necessário.

### F6 — CI e limpeza

Gates obrigatórios:

```
bun run lint
bun run typecheck
bun run test
bun run build
bun run verify:nexus
bun run check
```

Nenhuma remoção de código antigo deve ocorrer apenas porque uma implementação nova existe; primeiro confirmar que não há importação, rota, teste ou fluxo protegido dependendo dela.

### F7 — Aceitação do runtime principal

Validar:

- chat normal;
- streaming;
- seleção de modelo;
- indisponibilidade do Ollama;
- pesquisa Web;
- indisponibilidade do SearXNG;
- uploads;
- documentos;
- autenticação;
- build de produção;
- Android separado, sem alterações especulativas.

## VoiceStudio

### F8 — Contrato de voz

Criado:

- `api/_lib/voiceTypes.ts`
- `api/_lib/voiceRuntime.ts`
- `api/_lib/voiceStudioRuntime.ts`
- `tests/voiceRuntime.test.ts`

O contrato mantém o VoiceStudio como implementação substituível.

### F9 — VoiceStudio self-hosted

O Compose agora possui um profile opcional:

```
docker compose --profile voice up -d
```

O serviço usa a imagem oficial publicada pelo projeto, volume persistente para dados do VoiceStudio e cache persistente de modelos.

O serviço não publica a porta 3900 no host. O Orbit acessa `http://voicestudio:3900` somente pela rede interna.

A chave `VOICE_STUDIO_API_KEY` é usada no tráfego entre containers quando configurada.

### F10 — Voz no Orbit

Usar os endpoints documentados do VoiceStudio:

- `POST /v1/audio/speech` para TTS;
- `POST /v1/audio/transcriptions` para STT;
- `GET /v1/models` para descoberta;
- `POST /profiles` para clonagem, com confirmação explícita de consentimento.

Não criar endpoints fictícios como `/api/tts`, `/api/stt` ou `/api/voices/clone`.

### F11 — Ditado

Microfone → STT → transcrição bruta → refinamento pelo Ollama → documento.

Guardar separadamente:

- `rawTranscript`;
- `refinedTranscript`;
- idioma;
- timestamps quando disponíveis;
- referência do artefato de áudio, quando persistido.

### F12 — Leitura de documentos

Adicionar ações contextuais:

- Ouvir documento;
- Ouvir seleção;
- Continuar leitura;
- Pausar;
- alterar voz/velocidade.

O texto deve ser obtido do documento atual, não duplicado manualmente em estado paralelo.

### F13 — TTS streaming

Usar o modo de streaming documentado pelo VoiceStudio. Áudio deve chegar como fluxo/artefato e não ser acumulado indefinidamente em base64 no estado React.

### F14 — Perfis de voz

Biblioteca de vozes separada do histórico de chat. Clonagem exige consentimento explícito e deve manter metadados de origem/licença.

### F15 — MCP

Adicionar VoiceStudio ao `ecosystem-mcp` somente depois do contrato REST estar estável.

Ferramentas previstas:

- `generate_speech`;
- `transcribe`;
- `list_voices`;
- `list_languages`;
- `check_health`;
- `clone_voice` com consentimento.

### F16 — Dublagem e audiobooks

Só depois de TTS/STT, artefatos e perfis estarem estáveis. Dublagem e audiobooks não devem aumentar a complexidade do chat principal.

## Critérios finais de aceitação

### IA

- [ ] Ollama é o único runtime de inferência.
- [ ] SearXNG fornece Web real quando solicitado/necessário.
- [ ] A ausência da Web não causa alucinação silenciosa: a UI deve indicar que a pesquisa não estava disponível quando isso for relevante.
- [ ] Streaming continua compatível com o contrato existente.
- [ ] Modelos locais podem ser selecionados.

### Documentos

- [ ] PDF abre e pode ser lido/extraído.
- [ ] PDF escaneado pode passar por OCR.
- [ ] DOCX abre e preserva o original.
- [ ] XLSX/ODS/CSV continuam utilizáveis como planilhas.
- [ ] PPTX continua utilizável como apresentação.
- [ ] ONLYOFFICE salva de volta para o armazenamento quando configurado.
- [ ] Exportação não corrompe o arquivo.
- [ ] Arquivos grandes são rejeitados de forma previsível.
- [ ] Falha de OCR/conversão mostra erro recuperável.
- [ ] Android mantém assets offline de OCR.

### Voz

- [ ] VoiceStudio é opcional.
- [ ] Orbit inicia sem VoiceStudio.
- [ ] STT/TTS não bloqueiam o chat.
- [ ] Voz clonada exige consentimento.
- [ ] Áudio é artefato, não texto/base64 permanente no histórico.

## Ordem recomendada

```
Ollama
  ↓
SearXNG
  ↓
Docker
  ↓
Documentos + PDF/OCR + ONLYOFFICE
  ↓
CI/aceitação
  ↓
VoiceStudio
  ↓
STT/TTS
  ↓
Ditado e leitura de documentos
  ↓
Streaming de voz
  ↓
Perfis de voz
  ↓
MCP
  ↓
Dublagem/audiobooks
```
