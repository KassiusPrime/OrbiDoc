# Roadmap de implementação — extensões próprias do Orbit

Este roadmap é a ponte entre a matriz de engenharia reversa e o código.

## Fase 0 — inventário e contratos
- [x] Inspecionar estrutura atual: React/TypeScript/Vite, Express, Firebase, hub e engines existentes.
- [x] Identificar dependência de Document Server no editor Office atual.
- [x] Registrar APIs públicas de extensibilidade como referência.
- [ ] Auditar todos os pontos de navegação e decidir os caminhos de migração sem quebrar projetos salvos.
- [ ] Definir fixtures DOCX/XLSX/PPTX/PSD/SVG/PDF com recursos progressivos.

## Fase 1 — núcleo de extensões
- [ ] Criar `OrbitExtensionManifest` e um registry estático.
- [ ] Criar contrato `OrbitAiTool` com validação de argumentos e permissões.
- [ ] Substituir invocação por seletores DOM por chamadas de comandos tipados.
- [ ] Definir eventos comuns: `document.open`, `document.changed`, `document.saved`, `asset.created`, `export.completed`.
- [ ] Adicionar capability flags para desktop/mobile e offline.

## Fase 2 — Writer
- [ ] Modelo de documento tipado e versionado.
- [ ] Edição de texto, blocos, estilos, listas, tabelas e imagens.
- [ ] Importação/exportação DOCX com relatório de compatibilidade.
- [ ] PDF por exportação controlada.
- [ ] Operações de IA como patches com preview/undo.

## Fase 3 — Sheets
- [ ] Modelo workbook/sheet/range/cell.
- [ ] Motor de fórmulas isolado e coberto por testes.
- [ ] Importação/exportação XLSX/CSV.
- [ ] Gráficos e validação de dados.
- [ ] Testes de round-trip.

## Fase 4 — Slides
- [ ] Modelo deck/slide/layout/theme.
- [ ] Edição de objetos, imagens e texto.
- [ ] Importação/exportação PPTX.
- [ ] Notas, masters e relatórios de compatibilidade.
- [ ] Testes de round-trip.

## Fase 5 — Design / Adobe-like
- [ ] Manter Design Studio como base, sem criar outro editor paralelo.
- [ ] Pipeline de filtros e ajustes não destrutivos.
- [ ] Máscaras, seleções e geometria vetorial.
- [ ] Protótipo PhotoCraft/WASM em branch isolada, com métricas de bundle e memória.
- [ ] Fixtures para camadas, masks, blend modes, fontes e transparência.

## Fase 6 — PDF/OCR e mídia
- [ ] Separar renderização, OCR, anotações e manipulação estrutural de PDF.
- [ ] Workers/cancelamento/limites para operações de mídia.
- [ ] Preservação de metadados e relatório de perda de fidelidade.

## Definition of Done por recurso
- testes unitários e fixtures reais;
- erro e recurso não suportado são explícitos;
- operação pode ser desfeita quando alterar conteúdo;
- exportação abre em leitores externos;
- importação/exportação round-trip medida;
- fluxo validado no desktop e no Android quando aplicável;
- nenhuma chave ou token fica exposto no bundle do cliente;
- documentação atualizada.
