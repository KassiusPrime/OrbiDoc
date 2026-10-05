# Fase 4 — Frontend

Implementado:

- seletor de modelos instalados pelo Ollama;
- persistência em `localStorage` como `orbit.chatModel`;
- estado offline compartilhado entre `AiRuntimeStatus` e `AiWorkspace`;
- polling de health a cada 30s, suspenso enquanto a aba está oculta;
- badge/estado SearXNG sem bloquear o chat;
- limite de upload centralizado no cliente;
- validação server-side de payload base64;
- OCR preservado sem worker manual redundante;
- limites do leitor/OCR/imagem auditados;
- card legado Gemini/Groq/OpenRouter removido.

Uma regressão inicial no leitor local foi revertida para preservar o contrato histórico de 120 MB; o limite central permanece aplicado nos fluxos de upload/OCR/imagem.

## Gate

A primeira execução encontrou essa regressão e foi corrigida. O gate final da migração ficou verde em lint, typecheck, testes, build, PWA, mobile e Android.
