# ONLYOFFICE Docs para o Orbit

Este diretório fornece uma implantação de referência do ONLYOFFICE Docs Community atrás de Caddy, com HTTPS automático e JWT habilitado. Não é executado dentro da Vercel: o Document Server precisa de um host que suporte Docker e serviços persistentes.

## Requisitos

- VPS Linux com Docker Engine e Docker Compose;
- pelo menos 4 GB de RAM, 40 GB livres em disco e 4 GB de swap, conforme os requisitos oficiais do ONLYOFFICE Docs Community;
- um domínio/subdomínio público com registro DNS A apontando para o IP do VPS;
- portas TCP 80 e 443 abertas no firewall.

## Instalação

1. Copie `.env.example` para `.env`.
2. Edite `.env`: defina `ONLYOFFICE_DOMAIN` para o domínio real e gere `ONLYOFFICE_JWT_SECRET` com `openssl rand -hex 32`.
3. Mantenha o segredo fora do Git e de qualquer variável `VITE_*`.
4. Na pasta `infra/onlyoffice`, execute `docker compose up -d`.
5. Aguarde a inicialização e verifique `https://SEU-DOMINIO/healthcheck`. A primeira inicialização pode demorar alguns minutos.
6. No painel da Vercel, defina em **Production** e **Preview**:
   - `ONLYOFFICE_DOCUMENT_SERVER_URL=https://SEU-DOMINIO`
   - `ONLYOFFICE_JWT_SECRET=` exatamente o mesmo segredo definido no arquivo `.env` do VPS.
7. Faça novo deploy da Vercel e abra Documento, Planilha e Apresentação no Orbit.

## Segurança e operação

- Não exponha diretamente a porta 80 do serviço documentserver; o Caddy faz o proxy reverso e termina HTTPS.
- Restrinja acesso SSH ao VPS e mantenha Docker, Caddy e ONLYOFFICE atualizados.
- Faça backup dos volumes antes de atualizar a imagem.
- Para produção, fixe uma versão testada da imagem em vez de depender indefinidamente de `latest`.
- A Community Edition é licenciada sob AGPLv3. Confirme a compatibilidade da licença com a distribuição e o modelo de uso do Orbit.

Referências oficiais:
- Requisitos Docker: https://helpcenter.onlyoffice.com/pt-BR/docs/installation/docs-community-sys-reqs-docker.aspx
- Instalação Docker: https://helpcenter.onlyoffice.com/pt-BR/docs/installation/docs-community-install-docker.aspx
- Configuração JWT: https://helpcenter.onlyoffice.com/pt-Br/docs/installation/docs-configure-jwt.aspx

Esta configuração é um modelo de implantação, não uma instância hospedada. A integração só pode ser testada ponta a ponta depois de executar o Compose num VPS real, confirmar o healthcheck e configurar as variáveis da Vercel.
