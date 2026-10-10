# ONLYOFFICE no Orbit

## Estado e decisão arquitetural

O Orbit possui um bridge de código para o ONLYOFFICE Docs e usa o componente OnlyOfficeEditor como ponto de integração para:
- documentos de texto;
- planilhas;
- apresentações.

**A integração só fica operacional depois que um Document Server externo estiver implantado e configurado.** O código não instala nem hospeda o ONLYOFFICE Docs. Sem as variáveis ONLYOFFICE_DOCUMENT_SERVER_URL e ONLYOFFICE_JWT_SECRET, o bridge deve responder 503 ONLYOFFICE_NOT_CONFIGURED, sem falhar com erro genérico.

O editor visual de Design continua separado porque não é um editor Office. OCR/Reader continua separado porque é uma etapa de ingestão e leitura.

## Fluxo de integração

1. O frontend solicita /api/onlyoffice/config com o token de autenticação Firebase do usuário.
2. O backend confirma que o projeto existe e cria uma configuração assinada por JWT.
3. O ONLYOFFICE Docs baixa o documento por /api/onlyoffice/document quando o arquivo ainda não foi salvo no Storage.
4. Ao salvar, o Document Server envia o callback para /api/onlyoffice/callback.
5. O callback só baixa arquivos cuja origem corresponda à origem configurada do Document Server; redirecionamentos são bloqueados.
6. O arquivo editado é salvo no Firebase Storage e a referência é atualizada no Firestore.

Os três endpoints são registrados no servidor Express compartilhado. Eles não devem existir simultaneamente como funções Vercel separadas em api/onlyoffice/, porque isso sombreava o servidor principal e produzia FUNCTION_INVOCATION_FAILED.

## Configuração necessária na Vercel

Configure as variáveis no projeto Orbit. Não coloque segredos em variáveis VITE_*, no frontend ou no Git.

- **ONLYOFFICE_DOCUMENT_SERVER_URL**: URL HTTPS pública do Document Server, por exemplo https://office.exemplo.com.
- **ONLYOFFICE_JWT_SECRET**: segredo forte, idêntico ao configurado no Document Server para validação JWT.
- **ONLYOFFICE_PUBLIC_ORIGIN** (opcional): origem pública fixa do Orbit quando a origem inferida por VERCEL_URL não for a desejada.
- **VITE_ONLYOFFICE_CONFIG_URL** (opcional): caminho de configuração do frontend; por padrão, /api/onlyoffice/config.

A URL do Document Server e o segredo JWT precisam estar definidos em **Production** e também em **Preview** para testar os deploys de pull request. Os valores não podem ficar vazios. O segredo deve corresponder ao servidor remoto; criar um segredo aleatório somente na Vercel não conclui a configuração.

## Requisitos do Document Server

- Deve ser acessível publicamente por HTTPS a partir do navegador do usuário e dos servidores da Vercel.
- Deve conseguir baixar URLs do Orbit e enviar callbacks para a origem pública do deployment.
- JWT deve estar habilitado e usar exatamente o mesmo segredo de ONLYOFFICE_JWT_SECRET.
- A configuração de rede, proxy e firewall precisa permitir os pedidos entre o Document Server e o Orbit.
- Para edição colaborativa, os usuários precisam acessar o mesmo documento e a chave do documento deve permanecer estável enquanto a versão editada não muda.

## Persistência e segurança

A persistência usa Firebase Firestore e Storage com o token Firebase do usuário. O bridge:
- valida a autenticação antes de emitir a configuração;
- expira os tokens intermediários;
- limita o corpo do callback a 1 MiB;
- valida tipo de documento e campos obrigatórios;
- restringe a origem de download à origem configurada do ONLYOFFICE;
- bloqueia redirecionamentos para reduzir risco de SSRF;
- limita o arquivo baixado a 25 MiB.

Antes de produção, também é necessário validar concorrência de salvamento, versionamento real em edições simultâneas, regras de acesso do Firestore/Storage, expiração durante sessões longas e testes reais com DOCX, XLSX e PPTX. Os testes de código não substituem um teste de ponta a ponta com um Document Server configurado.

## Licenciamento

O ONLYOFFICE Docs Community é AGPLv3; a edição Developer é comercial. Antes de colocar o servidor em produção, confirme que a licença escolhida é compatível com a distribuição, hospedagem e modelo de uso do Orbit. Não reutilize branding ou assets de terceiros sem verificar suas licenças.

## Experiência de produto

O Orbit mantém sua própria identidade visual e o Nexus AI como assistente. O ONLYOFFICE é incorporado como motor de edição Office; não é necessário copiar a marca ou toda a interface de outro produto.
