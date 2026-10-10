# Orbit — arquitetura de núcleo de IA e aplicativos extensíveis

**Status:** proposta técnica inicial baseada na inspeção do branch `main` em 10/10/2026.  
**Objetivo:** transformar o Orbit numa plataforma cujo núcleo é a IA e cujos aplicativos especializados são módulos próprios, com contratos estáveis, carregamento independente e estado/documentos interoperáveis.

## 1. Diagnóstico do código atual

O repositório é uma aplicação React 19 + TypeScript + Vite, com servidor Express e Firebase. O `package.json` já inclui ferramentas úteis para construir engines próprias: `docx`, `mammoth`, `xlsx`, `pptxgenjs`, `pdfjs-dist`, `@imagemagick/magick-wasm`, `tesseract.js` e `jszip`.

O código atual ainda não representa uma plataforma de extensões formal:
- `TabType` enumera os destinos principais de navegação diretamente;
- `OfficeSuiteHub.tsx` lista Word, Excel e PowerPoint e descreve-os como baseados no ONLYOFFICE;
- `OnlyOfficeEditor.tsx` carrega a API de um Document Server externo;
- `DesignEditorStudio.tsx` já tem um modelo próprio de elementos, desenho em canvas, histórico e exportação;
- `AiWorkspace.tsx` e a infraestrutura de IA já são partes importantes da aplicação.

A meta é evoluir a estrutura gradualmente, sem reescrever tudo de uma vez nem remover recursos existentes antes de haver substitutos testados.

## 2. Modelo de produto

### Núcleo: Orbit AI / Nexus

O núcleo de IA é responsável por:
- entender a intenção do usuário e selecionar uma ferramenta;
- converter pedidos em ações estruturadas, com parâmetros validados;
- ler contexto autorizado do documento ativo;
- propor alterações como operações explícitas e revisáveis;
- executar fluxos entre aplicativos (por exemplo, texto → planilha → gráfico → slides);
- manter histórico de ações, referências de origem e capacidade de desfazer;
- respeitar permissões, limites de arquivos e políticas de privacidade.

O núcleo **não** deve ser o motor de renderização de documentos. Um editor precisa continuar utilizável quando o modelo estiver indisponível.

### Extensões internas do Orbit

Uma extensão é um módulo do produto — não necessariamente uma extensão de navegador. Cada módulo pode fornecer:
- um aplicativo com rota/tela própria;
- comandos que a IA pode invocar;
- tipos de documento e importadores/exportadores;
- ferramentas de interface;
- permissões e capacidades declaradas;
- testes de contrato;
- versão e migrações de dados.

A interface deve usar uma linguagem visual comum, sem forçar que todos os editores tenham a mesma disposição ou os mesmos controles.

## 3. Contrato de extensão proposto

Cada extensão declara um manifesto validado, por exemplo:

```ts
export interface OrbitExtensionManifest {
  id: string;                 // ex.: "orbit.writer"
  name: string;
  version: string;
  description: string;
  entry: string;               // ponto de entrada interno, nunca código remoto arbitrário
  documentTypes: string[];
  capabilities: string[];      // ex.: "document.read", "document.edit", "export.pdf"
  aiTools: OrbitAiToolManifest[];
  permissions: string[];       // acesso mínimo necessário
  mobileSupport: "full" | "limited" | "desktop";
}
```

Requisitos de segurança:
- nenhuma extensão recebe acesso amplo a Firebase, tokens OAuth ou arquivos por padrão;
- capacidades concedidas explicitamente e verificadas no backend quando houver dados protegidos;
- validar os argumentos das ferramentas com esquemas em runtime;
- não executar código baixado dinamicamente;
- separar metadados, conteúdo do documento, arquivos binários e segredos;
- operações de escrita devem gerar um patch/command revisável e desfazível;
- registrar a versão do formato e oferecer migrações explícitas.

**Importante:** a primeira implementação pode usar um registry estático TypeScript. Não precisamos de um sistema de plugins remotos, microfrontends ou importação dinâmica de código para começar.

## 4. Modelo de documento interoperável

Não tentar representar todos os formatos em um único objeto genérico cheio de campos opcionais. Usar um envelope comum com payload tipado:

```ts
export interface OrbitDocument<TContent> {
  id: string;
  type: "writer" | "sheets" | "slides" | "design" | "pdf" | "media";
  schemaVersion: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  content: TContent;
  assets: OrbitAssetRef[];
  source?: { format: string; importedAt: string };
}
```

Cada engine é dona do seu modelo:
- Writer: blocos, parágrafos, estilos, tabelas, seções, cabeçalhos/rodapés e comentários;
- Sheets: workbook, sheets, células, fórmulas, estilos, intervalos, nomes e gráficos;
- Slides: deck, masters/layouts, slides, objetos, mídia, notas e tema;
- Design: canvas, objetos, máscaras, filtros, camadas e assets;
- PDF: páginas, anotações, seleções e tarefas de OCR; edição do conteúdo PDF é um domínio separado da leitura/OCR.

Assets binários ficam fora do payload principal e são referenciados por IDs. Salvar documento não deve exigir serializar imagens enormes em JSON.

## 5. Arquitetura lógica

```text
Orbit AI / Nexus
  ├── Intent router + planner
  ├── Tool registry + schema validation
  ├── Context broker (documento selecionado, somente permissões concedidas)
  ├── Patch/command review + undo
  └── Workflow runner
          │
          ▼
Extension Registry (manifestos estáticos e contratos)
  ├── Writer Engine
  ├── Sheets Engine
  ├── Slides Engine
  ├── Design Engine
  ├── PDF/OCR Engine
  └── Media Engine
          │
          ▼
Document models + asset store + import/export adapters
          │
          ▼
Persistência, histórico, exportação e integrações opcionais
```

O registro de ferramentas da IA não deve depender de nomes de botões ou de seletores DOM. Remover gradualmente o padrão de abrir ferramentas clicando em botões encontrados via `document.querySelector`; substituir por comandos tipados expostos pelos módulos.

## 6. Engines próprias — direção por aplicativo

### Orbit Writer (documentos)
- Primeiro: modelo de blocos e estilos; edição de texto estável; listas, tabelas, imagens, cabeçalho/rodapé e paginação;
- importar DOCX com preservação explícita do que for suportado; exportar DOCX; exportar PDF;
- rastrear recursos não suportados e avisar antes de descartar conteúdo;
- depois: comentários, revisão, comparação e colaboração.

Não começar prometendo paridade integral com Word. Começar por uma matriz de compatibilidade e por casos de uso reais.

### Orbit Sheets (planilhas)
- modelo de workbook com múltiplas abas e células tipadas;
- fórmulas numa engine isolada e testável; não executar fórmulas como JavaScript;
- referência de célula, intervalo, cópia/colagem, estilos, importação/exportação XLSX/CSV;
- gráficos e tabelas dinâmicas entram depois da consistência do modelo;
- fórmulas não suportadas devem ser identificadas, nunca silenciosamente convertidas em valores incorretos.

### Orbit Slides (apresentações)
- modelo de deck, layouts, temas, notas e objetos;
- edição de texto/formas/imagens e reordenação de slides;
- importação/exportação PPTX com relatório de compatibilidade;
- geração assistida por IA usando estrutura semântica de slides, não somente imagens rasterizadas.

### Orbit Design (gráficos e imagem)
- manter o Studio próprio existente como base vetorial/layout;
- adicionar pipeline de imagem não destrutivo (filtros/ajustes como operações separadas);
- manter objetos vetoriais editáveis e separar rasterização da representação do projeto;
- investigar PhotoCraft como referência e possível componente opcional apenas após protótipo WASM isolado e auditoria de licenças/compatibilidade.

### Orbit PDF & Scan
- separar leitura/renderização, OCR, anotações, montagem/reordenação e edição real de objetos PDF;
- pipeline de OCR com coordenadas, confiança e revisão do texto extraído;
- explicar claramente quando uma operação recria o PDF e pode alterar fidelidade.

### Orbit Media
- conversão de arquivos, áudio e imagem em tarefas independentes;
- workers para operações pesadas e limites de tamanho;
- pré-visualização e progresso, com cancelamento e limpeza de assets temporários.

## 7. Contrato de comandos da IA

Ferramentas devem ser declarativas e tipadas:

```ts
interface OrbitAiTool<TInput, TOutput> {
  id: string;
  description: string;
  inputSchema: unknown;  // implementar com validador runtime no código
  execute(input: TInput, context: OrbitToolContext): Promise<TOutput>;
}
```

Exemplos de comandos de alto nível:
- `writer.insertText`
- `writer.applyStyle`
- `sheets.setRangeValues`
- `sheets.createChart`
- `slides.createDeck`
- `slides.rewriteSlide`
- `design.addLayer`
- `design.adjustImage`
- `pdf.runOcr`

A IA deve devolver operações estruturadas, não HTML arbitrário para injetar no editor. Antes de aplicar alterações em lote, apresentar resumo e opção de pré-visualizar/desfazer.

## 8. Importação, exportação e compatibilidade

Criar adaptadores independentes:
- `importDOCX` / `exportDOCX`
- `importXLSX` / `exportXLSX`
- `importPPTX` / `exportPPTX`
- `importPDF` / `exportPDF`
- `importSVG` / `exportSVG` e formatos raster para Design.

Cada adaptador precisa de fixtures reais e testes de ida/volta. “Arquivo exportado abre” é diferente de “round-trip preserva fidelidade”. Medir separadamente texto, layout, fórmulas, estilos, fontes, mídia, metadados e recursos não suportados.

## 9. Ordem recomendada

1. Formalizar registry de extensões e contrato de comandos sem alterar ainda os editores ativos.
2. Criar harness de compatibilidade para arquivos e snapshots.
3. Implementar Writer próprio para o subconjunto prioritário, começando com DOCX/HTML estruturado.
4. Implementar Sheets próprio com fórmulas e XLSX.
5. Implementar Slides próprio com PPTX.
6. Evoluir Design com pipeline não destrutivo e protótipo PhotoCraft/WASM isolado.
7. Consolidar PDF/OCR e Media como engines independentes.
8. Migrar o hub para declarar aplicativos pelo registry, remover textos que afirmam depender de ONLYOFFICE quando os engines próprios estiverem disponíveis e manter fallback/legacy apenas enquanto necessário.

Não apagar o editor atual antes de ter cobertura de compatibilidade e uma migração verificável.

## 10. Critérios de conclusão

- Cada extensão tem manifesto, permissões, comandos, tipos e testes;
- a IA pode invocar comandos sem simular cliques na UI;
- operações de escrita são revisáveis e desfazíveis;
- formato e schema version estão explícitos;
- importação/exportação possui fixtures e relatórios de perdas;
- engines principais funcionam sem conexão com um provedor de IA;
- os fluxos essenciais passam em desktop e mobile;
- CI executa lint, TypeScript, testes, build e verificações de segurança;
- o usuário nunca perde silenciosamente conteúdo que o motor não consegue representar.

## 11. Referências públicas consultadas

- Microsoft Office Add-ins: https://learn.microsoft.com/en-us/office/dev/add-ins/develop/develop-overview
- Google Workspace add-on types: https://developers.google.com/workspace/add-ons/concepts/types
- Adobe Photoshop APIs/UXP: https://developer.adobe.com/photoshop/
- Adobe UXP: https://developer.adobe.com/uxp/
- LibreOffice SDK: https://api.libreoffice.org/
- LibreOffice UNO extensions: https://help.libreoffice.org/latest/pt-BR/text/shared/guide/integratinguno.html

Essas referências são usadas para estudar padrões de extensibilidade, não como dependências obrigatórias dos engines do Orbit.
