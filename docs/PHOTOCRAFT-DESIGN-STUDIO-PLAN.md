# Proposta técnica — PhotoCraft-inspired Design Studio

## Objetivo

Evoluir a aba **Design** do OrbiDoc para um estúdio de edição de imagens mais profundo, inspirado em capacidades e padrões observáveis do projeto open-source [PhotoCraft](https://github.com/storytold/photocraft), sem transformar o Orbit numa cópia visual do Photoshop e sem substituir o editor existente antes de validar a compatibilidade.

PhotoCraft é um editor em Rust com modelo de documento baseado em camadas, máscaras, ajustes não destrutivos, ferramentas de pintura e seleção, formatos PSD/PSB e um motor de comandos dirigível por UI/CLI/MCP. Seu repositório informa que ainda está em alpha; a compatibilidade e o estado de cada recurso devem ser verificados na versão consultada.

## Diagnóstico inicial do OrbiDoc

Na branch `main`, o repositório já possui:
- `src/components/DesignEditor.tsx`, usado pelo fluxo `CanvaDesignStudio.tsx`;
- `src/components/DesignEditorPro.tsx`;
- `src/components/DesignEditorStudio.tsx`, com estado de design v4, canvas, elementos, formas, texto, importação de imagem, zoom e exportação;
- `src/lib/officeStudio`, que fornece tipos e utilitários compartilhados para o estúdio;
- dependências existentes para manipulação de imagem e PDF.

**Não criar um quarto editor paralelo.** Primeiro comparar os três editores, identificar qual é o fluxo realmente ativo e definir um único ponto de entrada, mantendo adaptadores de migração para projetos existentes.

## Direção de produto

A aba Design deve oferecer dois modos de trabalho, sem confundir seus objetivos:

1. **Design rápido** — peças, layouts, texto, formas, templates e composição visual, próximo do uso atual.
2. **Edição de imagem** — edição raster com camadas, máscaras, seleções, ajustes e filtros, inspirada nas capacidades do PhotoCraft.

Ambos compartilham identidade visual Orbit, projetos, importação/exportação e histórico, mas mantêm ferramentas contextuais próprias. Não empilhar barras de ferramentas de ambos os modos.

## Plano incremental

### Fase 1 — Auditoria antes de código
- Ler `AGENTS.md`, `DOCUMENTATION.md`, `package.json`, `PLATFORMS.md` e a documentação de arquitetura relevante.
- Rastrear como a aba Design é aberta em `AppV5.tsx` e `OfficeSuiteHub.tsx`.
- Comparar `DesignEditor.tsx`, `DesignEditorPro.tsx` e `DesignEditorStudio.tsx`: capacidades, persistência, exportação, acessibilidade, dependências e duplicação.
- Registrar quais recursos funcionam de verdade e quais são apenas apresentados na UI.
- Criar testes de regressão para abrir, editar, salvar e reabrir projetos existentes.
- Não modificar a arquitetura até que este mapa esteja pronto.

### Fase 2 — Melhorias de alto valor no editor atual
Implementar em pequenas entregas, de acordo com o que a auditoria confirmar:
- painel de camadas com reordenação, agrupamento e visibilidade;
- histórico undo/redo confiável e recuperação após recarregar;
- seleção múltipla, alinhamento, distribuição, guias e snapping;
- transformação com proporção, rotação e controles por teclado;
- zoom/pan e canvas de alta resolução sem travar a interface;
- ajustes não destrutivos: exposição/brilho, contraste, saturação, temperatura, curvas e níveis;
- máscaras de camada e ferramentas de seleção como etapas posteriores;
- exportação com formato, qualidade, transparência, escala e prévia de tamanho;
- atalhos documentados, command palette e estados acessíveis.

Não mostrar um botão como funcional se a operação correspondente não estiver implementada. Para recursos ainda não disponíveis, ocultar ou marcar como indisponíveis com explicação clara.

### Fase 3 — Avaliar integração técnica com PhotoCraft
PhotoCraft é Rust nativo e também tem uma compilação WebAssembly. A aplicação atual do OrbiDoc é React/TypeScript/Vite com backend Node/Express. Portanto, **não importar crates Rust diretamente para o bundle React** nem adicionar um shell Tauri/Electron sem uma decisão arquitetural explícita.

Fazer um protótipo isolado para avaliar:
- se o build WebAssembly atual do PhotoCraft pode ser incorporado em uma rota/surface própria;
- tamanho do WASM, tempo de carregamento, memória, WebGPU e fallback;
- abertura/salvamento de arquivos e interoperabilidade com o estado de projetos Orbit;
- comunicação entre o editor e a aplicação sem acoplamento frágil;
- comportamento em navegadores móveis e no runtime Android do OrbiDoc;
- licenças de código, fontes, ícones e assets individualmente;
- superfície de segurança, isolamento, atualização e manutenção.

Se o protótipo não atender aos limites de tamanho, memória, experiência móvel ou integração, manter o editor Orbit e implementar apenas capacidades próprias inspiradas em comportamentos documentados. Não criar um microserviço Rust apenas para evitar a integração WASM sem demonstrar benefício.

### Fase 4 — Formatos e integridade
- Priorizar PNG, JPEG e WebP no primeiro ciclo.
- Investigar PSD/PSB como compatibilidade avançada, com corpus de teste e limites explícitos.
- Nunca descartar silenciosamente camadas ou metadados não suportados durante importação/exportação.
- Preservar originais; usar edições não destrutivas quando possível.
- Executar testes com arquivos pequenos, grandes, inválidos, transparentes, com perfil de cor e múltiplas camadas.

## Arquitetura sugerida

Separar responsabilidades, sem introduzir abstrações prematuras:
- **DesignProject**: metadados, dimensões, versão e persistência;
- **DesignDocument**: elementos, camadas, máscaras e ajustes;
- **DesignCommand**: operações validadas e reversíveis;
- **DesignHistory**: undo/redo e recuperação;
- **DesignRenderer**: renderização e cache;
- **DesignIO**: importação/exportação;
- **DesignWorkspace**: shell visual específico do modo ativo.

Antes de criar essas abstrações, verificar o que já existe em `officeStudio` e nos editores atuais. Reutilizar ou migrar antes de duplicar.

## Critérios de aceite

- Um único fluxo principal de edição, sem três editores concorrentes apresentados como equivalentes.
- Projetos existentes continuam abrindo e salvando.
- Ferramentas principais realmente alteram o documento e são cobertas por testes.
- Undo/redo não perde elementos ou altera o estado de forma inesperada.
- Exportação testada por reabertura do arquivo gerado.
- Editor responsivo sem sobreposição de painéis em mobile/tablet/desktop.
- Carregamento do modo de edição não bloqueia a navegação da aplicação.
- Nenhuma licença, integração ou compatibilidade é presumida sem verificação.
- Build, typecheck, lint e testes existentes passam antes de considerar a tarefa concluída.

## Referências

- PhotoCraft: https://github.com/storytold/photocraft
- PhotoCraft README: https://github.com/storytold/photocraft/blob/main/README.md
- PhotoCraft AGENTS: https://github.com/storytold/photocraft/blob/main/AGENTS.md
- OrbiDoc DesignEditor: https://github.com/KassiusPrime/OrbiDoc/blob/main/src/components/DesignEditor.tsx
- OrbiDoc DesignEditorPro: https://github.com/KassiusPrime/OrbiDoc/blob/main/src/components/DesignEditorPro.tsx
- OrbiDoc DesignEditorStudio: https://github.com/KassiusPrime/OrbiDoc/blob/main/src/components/DesignEditorStudio.tsx
