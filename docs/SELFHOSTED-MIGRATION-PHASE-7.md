# Fase 7 — Verificação final

## Aceite técnico confirmado

- lint: verde.
- typecheck: verde.
- 83 testes: verdes.
- verify:nexus: verde.
- build: verde.
- verify:pwa: verde.
- verify:playstore: verde.
- verify:native: verde.
- verify:mobile: verde.
- verify:auth: verde.
- Docker Compose config: verde.
- Docker image build: verde.
- APK Android debug: gerado com sucesso.
- Ollama/SearXNG não exigem serviços externos no pipeline de testes.
- contrato SSE `chunk/meta/[DONE]` preservado.
- Android/Capacitor permanece no mesmo contrato de API.
- OnlyOffice/Firebase/OAuth não foram alterados pelo núcleo da migração.

## Pendência operacional

A validação real `open → gerar/editar → salvar → reabrir` do Ollama/SearXNG precisa ocorrer em uma máquina/servidor que execute o Compose com o modelo instalado. O CI valida a imagem e os contratos, mas não possui uma instância persistente de Ollama de produção.

O Vercel continua sendo uma superfície secundária/preview; o runtime principal desta arquitetura é o Docker Compose self-hosted.
