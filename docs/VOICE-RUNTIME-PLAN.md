# Orbit — Voice Runtime / VoiceStudio Roadmap

## Objetivo

Adicionar voz ao Orbit sem transformar o produto em um segundo aplicativo embutido. O Orbit continua sendo a superfície principal; o VoiceStudio funciona como runtime local opcional para TTS, STT, clonagem, ditado e, posteriormente, dublagem/audiobooks.

A integração deve seguir a mesma regra arquitetural da migração Ollama/SearXNG: contrato neutro no Orbit, implementação substituível por adapter e degradação graciosa quando o runtime de voz não estiver disponível.

## Por que VoiceStudio entra como runtime

O VoiceStudio atual oferece workflows locais de clonagem, voice design, ditado, transcrição, dubbing e audiobooks, além de API local e MCP. A versão 0.5.6 também mantém integração com MCP e clientes como Codex/Cursor/Claude Code. O projeto é AGPL-3.0 e os modelos têm licenças próprias; clonagem de voz deve ocorrer somente com permissão.

Fonte de referência: https://github.com/debpalash/VoiceStudio

## Regra de integração

Não copiar o Electron/FastAPI/UI inteira do VoiceStudio para dentro do Orbit.

Arquitetura:

Orbit UI
  -> /api/voice/*
  -> VoiceRuntime
      -> VoiceStudioRuntime
          -> VoiceStudio local API / MCP

O Orbit conhece somente o contrato `VoiceRuntime`. O VoiceStudio pode ser substituído no futuro sem reescrever a superfície de voz.

## Contrato proposto

Criar:

- `api/_lib/voiceTypes.ts`
- `api/_lib/voiceRuntime.ts`
- `api/_lib/voiceStudioRuntime.ts`

Interface-base:

```ts
interface VoiceRuntime {
  status(): Promise<VoiceRuntimeStatus>;
  listVoices(): Promise<VoiceProfile[]>;
  listLanguages(): Promise<VoiceLanguage[]>;
  synthesize(input: SynthesizeRequest): Promise<AudioArtifact>;
  transcribe(input: TranscribeRequest): Promise<Transcript>;
  cloneVoice(input: CloneVoiceRequest): Promise<VoiceProfile>;
  streamTTS(
    input: SynthesizeRequest,
    onChunk: (chunk: AudioChunk) => void,
  ): Promise<void>;
}
```

## Configuração futura

Somente quando a Fase 8 começar:

- `VOICE_STUDIO_ENABLED=false`
- `VOICE_STUDIO_URL=http://voicestudio:3900`
- `VOICE_STUDIO_API_KEY=` opcional, server-side
- `VOICE_STUDIO_CLIENT_ID=orbit` para identificação do chamador quando aplicável

Nenhuma dessas variáveis deve ser `VITE_*`.

## Superfície do Orbit

A voz não ganha uma segunda navegação global. Ela entra na superfície única de áudio/voz do Orbit, coerente com a arquitetura existente.

A superfície deve reunir:

- texto -> áudio;
- áudio -> texto;
- waveform;
- escolha de voz;
- idioma;
- gravação/upload;
- ditado;
- ouvir documento;
- ler seleção;
- histórico de artefatos de áudio.

Recursos avançados ficam em drawer/inspector, não em novas barras globais.

## Fases de implementação

### Fase 8 — Voice Runtime Contract

- definir tipos neutros;
- implementar adapter;
- health/status;
- feature flag;
- testes com `node:test` e `globalThis.fetch`;
- nenhum VoiceStudio real exigido no CI.

Gate: lint + typecheck + test + build.

### Fase 9 — VoiceStudio self-hosted

- adicionar serviço opcional `voicestudio` ao Compose;
- manter o serviço em rede interna;
- não publicar a porta por padrão;
- healthcheck;
- volume persistente para modelos/dados;
- documentar GPU NVIDIA e alternativa CPU;
- definir limites de áudio e tamanho de referência.

Gate: `docker compose config`, imagem/runtime e health.

### Fase 10 — Voice API no Orbit

Adicionar, atrás de `VOICE_STUDIO_ENABLED`:

- `GET /api/voice/status`
- `GET /api/voice/voices`
- `GET /api/voice/languages`
- `POST /api/voice/speech`
- `POST /api/voice/transcription`
- `POST /api/voice/clone`

Sem VoiceStudio: endpoints retornam estado claro de indisponibilidade, sem quebrar o restante do Orbit.

### Fase 11 — Ditado

Fluxo:

microfone -> STT -> transcript bruto -> refinamento opcional pelo Ollama -> documento/chat.

Guardar separadamente:

- `rawTranscript`
- `refinedTranscript`
- `language`
- `createdAt`
- `source`

Nunca substituir silenciosamente a transcrição original.

### Fase 12 — Voice Output

- botão Ouvir;
- leitura de seleção;
- leitura de documento;
- fila de áudio;
- pausa/retomada;
- velocidade;
- destaque opcional da frase atual.

Áudio não deve ser colocado no histórico textual do chat como base64.

### Fase 13 — Streaming Voice

Quando o contrato estiver estável:

Ollama stream -> segmentador de frases -> TTS streaming -> player.

Objetivo: começar a falar antes de o modelo terminar toda a resposta.

Preferir WebSocket/stream do runtime de voz quando suportado; fallback para artefato de áudio completo.

### Fase 14 — Voice Profiles

WorkObject `voice`:

- voz local;
- voz desenhada;
- voz clonada;
- idioma;
- engine;
- consentimento;
- referência;
- data de criação.

Clonagem exige confirmação de permissão. Nunca sugerir que uma voz clonada representa uma pessoa real sem consentimento.

### Fase 15 — MCP Bridge

Adicionar no `ecosystem-mcp` ferramentas neutras:

- `voice.speak`
- `voice.transcribe`
- `voice.listVoices`
- `voice.listLanguages`
- `voice.status`

O MCP do Orbit chama o contrato do Orbit; não acessa banco/arquivos internos do VoiceStudio diretamente.

### Fase 16 — Dubbing / Audiobook

Somente depois de TTS/STT/streaming estáveis:

- dublagem de vídeo;
- preservação de timeline;
- separação de speakers;
- capítulos;
- EPUB/PDF -> audiobook;
- batch queue;
- exportação de legendas.

## Contratos de segurança

1. VoiceStudio não fica exposto na internet por padrão.
2. API key, se usada, fica exclusivamente server-side.
3. Uploads de áudio passam pelo mesmo princípio de limite de payload do Orbit.
4. O Orbit deve abortar requisições de voz quando o cliente desconectar.
5. WebSocket de voz exige autenticação/origin validation quando sair do loopback.
6. Áudio e transcrições devem ser tratados como dados potencialmente sensíveis.
7. Modelos e engines devem manter seus avisos/licenças individuais.

## Contratos de dados

Novos WorkObjects:

- `audio`
- `transcript`
- `voice`

Não armazenar áudio bruto dentro de mensagens do chat. Usar arquivo/artefato com referência estável.

## Critério de conclusão do Voice

O Voice só será considerado integrado quando:

- runtime pode ser ligado/desligado sem quebrar o Orbit;
- STT e TTS têm testes sem depender de GPU;
- chat de voz funciona ponta a ponta;
- leitura de documento funciona;
- ditado preserva transcript bruto;
- streaming possui fallback;
- Android/PWA continuam usando o mesmo backend;
- MCP possui ferramentas de voz documentadas;
- nenhuma porta interna de VoiceStudio é publicada por padrão;
- licenças e consentimento de clonagem estão documentados.

## Dependências e riscos

- VoiceStudio é AGPL-3.0; a forma de distribuição do serviço e eventual código derivado precisa ser avaliada antes de incorporar componentes do projeto diretamente.
- Engines e modelos podem ter licenças diferentes.
- TTS/STT podem exigir GPU, memória e armazenamento muito superiores ao Ollama 3B.
- Latência de CPU pode tornar streaming de voz pouco agradável; o fallback deve continuar sendo áudio completo.
- Clonagem de voz exige controle de consentimento e retenção de referências.

## Estado atual

Planejamento somente. Nenhum serviço VoiceStudio deve ser ativado no Compose até a Fase 8, para não aumentar a superfície de falha da migração Ollama/SearXNG já concluída.
