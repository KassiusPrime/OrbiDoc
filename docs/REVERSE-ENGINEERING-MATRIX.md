# Matriz de análise técnica — suítes de produtividade e criação

**Objetivo:** estudar capacidades, modelos de documento, formatos, APIs públicas, fluxos de trabalho e limites observáveis para orientar engines próprias do Orbit. Não é uma cópia de código-fonte proprietário.

## Como investigar cada sistema

Para cada produto, registrar:
1. Cenário de uso e jornada do usuário;
2. modelo mental e objetos editáveis;
3. formato aberto, estrutura e metadados;
4. APIs e formatos documentados;
5. comportamento observável em fixtures controladas;
6. diferenças entre desktop, web e mobile;
7. importação/exportação e perda de fidelidade;
8. acessibilidade, atalhos, undo/redo e autosave;
9. desempenho com arquivos pequenos, médios e grandes;
10. licença e restrições dos componentes que possam ser reutilizados.

Cada afirmação deve ser marcada como **documentada**, **observada em teste**, **inferida** ou **ainda não verificada**.

## Microsoft 365

### Superfícies a estudar
- Word: estrutura semântica, estilos, seções, cabeçalhos/rodapés, comentários, revisão, tabelas, paginação;
- Excel: workbook/sheet/range, fórmulas, tipos de célula, tabelas, gráficos, nomes e recálculo;
- PowerPoint: deck/slide/layout/master, tema, objetos, notas e mídia;
- integração entre apps, atalhos, comandos, colaboração e recuperação de versões.

### Fonte pública de extensibilidade
Office Add-ins usam manifesto + aplicação web e Office JavaScript APIs para interagir com documentos e estender a UI. Isso é referência para a arquitetura de plugins, não uma dependência para os editores próprios.  
Fonte: https://learn.microsoft.com/en-us/office/dev/add-ins/develop/develop-overview

### Experimentos
- montar DOCX/XLSX/PPTX de teste com recursos progressivos;
- abrir e salvar em clientes diferentes quando houver acesso legítimo;
- comparar conteúdo extraído, XML do pacote, imagens, estilos, fórmulas e layout;
- documentar diferenças em vez de presumir equivalência.

## Google Workspace

### Superfícies a estudar
- Docs: blocos, índices, estilos, tabelas, comentários e sugestões;
- Sheets: ranges, fórmulas, validação, filtros, gráficos e múltiplas abas;
- Slides: páginas, layouts, masters, temas e objetos;
- Drive: identidade do arquivo, permissões, versões, comentários e links.

### Fonte pública de extensibilidade
Google diferencia Workspace add-ons multiplataforma de Editor add-ons específicos de Docs/Sheets/Slides/Forms; os últimos podem usar menus, diálogos e sidebars e têm restrições próprias. Esse contraste ajuda a decidir o que é extensão global do Orbit e o que pertence a um editor específico.  
Fonte: https://developers.google.com/workspace/add-ons/concepts/types

### Experimentos
- comparar exportações Google ↔ formatos Office com arquivos de teste;
- medir fidelidade de fórmulas, estilos, fontes, gráficos e layout;
- registrar limitações de APIs e permissões sem depender de acesso privado.

## Adobe Creative Cloud

### Superfícies a estudar
- Photoshop: documento, camadas, máscaras, seleções, ajustes, efeitos, texto e objetos inteligentes;
- Illustrator: paths vetoriais, nós, strokes/fills, artboards, grupos e símbolos;
- InDesign: páginas, stories, estilos, frames e links;
- fluxos de exportação, perfis de cor, transparência, fontes e assets vinculados.

### Fonte pública de extensibilidade
Adobe documenta plugins e scripts UXP para Photoshop e outros hosts. O modelo de extensão de um host específico não deve ser confundido com um motor gráfico portátil; cada integração precisa respeitar APIs e capacidades daquele host.  
Fontes: https://developer.adobe.com/photoshop/ e https://developer.adobe.com/uxp/

### Experimentos
- começar com PSD/PSB e documentos vetoriais sintéticos;
- medir preservação de camadas, máscaras, blend modes, perfis de cor e fontes;
- testar rasterização e edição não destrutiva em separado;
- estudar PhotoCraft como projeto independente e validar licença, maturidade e compatibilidade antes de qualquer adoção.

## Suítes de escritório abertas

### LibreOffice
Usar a documentação e o SDK/UNO como fonte de conceitos de componentes, automação e extensão. Não embutir uma suíte inteira por padrão se a meta é criar engines próprias.  
Fontes: https://api.libreoffice.org/ e https://help.libreoffice.org/latest/pt-BR/text/shared/guide/integratinguno.html

### Formatos
DOCX, XLSX e PPTX são pacotes Open XML. A análise deve trabalhar em arquivos de teste próprios e documentação pública dos formatos; validar XML, relações, mídia, estilos, fórmulas e metadados. Não inferir fidelidade a partir de uma simples exportação.

## Rubrica de compatibilidade

Para cada recurso, marcar:
- **0 — não suportado**
- **1 — leitura parcial**
- **2 — leitura fiel**
- **3 — edição básica**
- **4 — edição + round-trip**
- **5 — edição fiel, teste automatizado e migração validada**

Dimensões mínimas:
- conteúdo;
- estrutura e ordem;
- estilos e temas;
- fontes e tipografia;
- imagens/objetos;
- fórmulas ou geometria;
- comentários/notas;
- metadados;
- acessibilidade;
- exportação e round-trip;
- comportamento desktop/mobile.

## Resultado esperado

A saída da engenharia reversa é uma especificação funcional baseada em evidência, um conjunto de fixtures de regressão e uma lista priorizada de comportamentos. Só depois se implementa a capacidade correspondente em código próprio do Orbit.
