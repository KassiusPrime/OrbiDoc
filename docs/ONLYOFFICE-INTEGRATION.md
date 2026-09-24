# ONLYOFFICE no Orbit

## Decisão arquitetural

O Orbit passa a tratar o ONLYOFFICE Docs como o editor principal para:
- documentos de texto (DOCX/ODT);
- planilhas (XLSX/ODS/CSV);
- apresentações (PPTX/ODP);
- futuramente, PDF e formulários quando o fluxo de armazenamento estiver preparado.

O editor visual de Design continua separado porque não é um editor Office. OCR/Reader continua separado porque é uma etapa de ingestão e leitura.

O frontend usa `OnlyOfficeEditor` e não escolhe um editor proprietário alternativo. A aplicação carrega o Docs API a partir de `VITE_ONLYOFFICE_DOCUMENT_SERVER_URL` e solicita uma configuração por documento em `/api/onlyoffice/config`.

## Bridge obrigatório

ONLYOFFICE não deve receber conteúdo local diretamente do navegador. O serviço de documentos precisa de URLs HTTP(S) acessíveis para baixar o arquivo e enviar o callback de salvamento.

Configure:
- `ONLYOFFICE_DOCUMENT_SERVER_URL`: URL pública do ONLYOFFICE Docs.
- `VITE_ONLYOFFICE_DOCUMENT_SERVER_URL`: mesma URL, exposta somente como endereço público.
- `VITE_ONLYOFFICE_CONFIG_URL`: endpoint de configuração, normalmente `/api/onlyoffice/config`.
- `ONLYOFFICE_DOCUMENT_URL_BASE`: endpoint backend que entrega o arquivo atual por projectId.
- `ONLYOFFICE_CALLBACK_URL_BASE`: endpoint backend que recebe o callback de salvamento por projectId.
- `ONLYOFFICE_JWT_SECRET`: segredo somente no backend quando JWT estiver habilitado no Document Server.

O callback deve validar o usuário, o projeto e a versão do documento antes de gravar. Nunca aceite um projectId arbitrário como autorização.

## Armazenamento

A camada de persistência deve guardar:
- arquivo Office original;
- MIME type;
- versão atual;
- hash/version key;
- proprietário/tenant;
- timestamps;
- permissões;
- status de edição.

O callback do ONLYOFFICE deve ser idempotente. Se receber a mesma versão mais de uma vez, não deve criar corrupção nem duplicar arquivos.

## Licenciamento

O ONLYOFFICE Docs Community é AGPLv3. A documentação oficial informa que uso em SaaS/rede sob AGPL exige cumprir as obrigações de copyleft e manter a atribuição/branding aplicável. A Developer Edition é comercial e é a opção destinada a integrar os editores em uma aplicação própria e fornecê-los aos usuários finais sob a marca do serviço.

Antes de colocar o servidor ONLYOFFICE em produção como parte do Orbit, a licença escolhida precisa ser compatível com a distribuição e o modelo do Orbit.

## UI inspirada no Copilot

O Orbit não copia a interface proprietária do Microsoft Copilot. Adota apenas padrões de interação úteis:
- navegação lateral persistente;
- botão claro para novo chat;
- pesquisa/histórico na lateral;
- área central dedicada ao trabalho;
- painel contextual lateral;
- contexto do arquivo atual;
- IA contextual ao lado do documento;
- painéis recolhíveis em telas grandes;
- adaptação para uma coluna no celular.

O Nexus AI continua sendo a IA do Orbit e permanece no runtime gratuito já definido pelo projeto.
