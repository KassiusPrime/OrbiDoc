# Orbit Reader, Player & Image Studio — Direção de produto

## Decisão de produto

O Orbit não deve ser uma cópia gratuita de suítes comerciais. O núcleo de valor é **um espaço de trabalho com IA que entende o conteúdo local do usuário e o encaminha para a ferramenta correta**, com privacidade, transparência e operações que o usuário consegue revisar.

Nesta direção, os apps Office editáveis deixam de ser destinos principais. Arquivos DOCX, XLSX, PPTX e projetos antigos continuam reconhecíveis, mas as rotas antigas os abrem no leitor e não alteram o conteúdo original.

## Espaços principais

- **Orbit Reader:** PDF, documentos Office, planilhas, apresentações, EPUB, texto, Markdown, imagens e entradas de arquivos ZIP quando o leitor consegue interpretar o formato. Busca dentro do conteúdo extraído. Não executa scripts embutidos nem salva por cima do original.
- **PDF & OCR:** captura/extração explícita; saída é um novo arquivo ou conteúdo enviado ao Nexus, nunca uma mutação silenciosa do arquivo de origem.
- **Orbit Player:** arquivos locais e URLs diretas, playlist por sessão, busca, retomada local, velocidade, atalhos, gestos móveis, legendas VTT/SRT, Picture-in-Picture quando disponível, tela cheia, loop A–B e informações da mídia.
- **Orbit Image Studio:** geração/edição remota apenas com modelo configurado; aprimoramento local continua disponível. O status da integração fica visível. Geração remota não configurada é um estado explícito, não um botão que finge sucesso.
- **Nexus AI:** interface única para perguntas, pesquisa, explicação e transformação de conteúdo. O usuário escolhe explicitamente o arquivo/contexto que quer compartilhar. Não deve usar seletores DOM para acionar navegação, nem apresentar cabeçalhos duplicados ou dizer “gratuito” quando o custo de uma operação depende da configuração.

## VLC: engenharia reversa permitida e limites de implementação

A análise de comportamento se baseia em documentação pública e no comportamento observável do VLC Android, sem copiar código, ícones, nome, marca ou design proprietários.

Padrões úteis a reproduzir numa interface original:
- controle de reprodução, posição, volume, velocidade e saltos de tempo;
- fila/playlist, anterior/próximo, aleatório e repetição;
- retomada de posição e atalhos;
- carregamento de legendas externas, loop A–B e Picture-in-Picture;
- gestos horizontais de busca e gestos laterais para brilho visual/volume;
- informações do arquivo e mensagens claras de erro;
- suporte para URLs diretas com limites documentados.

### Limite técnico importante

A implementação web usa os elementos de mídia do navegador/WebView. Ela **não** herda todos os codecs, contêineres, protocolos e recursos do VLC/LibVLC. Página de streaming, URL que exige autenticação, playlists HLS/DASH e formatos como MKV/AVI dependem do WebView, da origem e do codec disponível. A interface informa esse limite em vez de garantir suporte universal.

Para obter paridade ampla de codecs, o próximo passo seria avaliar uma implementação nativa baseada em LibVLC, com análise de licenças, dependências, distribuição, atribuições e implicações de copyleft antes de integrar qualquer biblioteca. O VLC Android é GPLv2-or-later; o repositório do VLC declara LibVLC Android como LGPLv2, enquanto o aplicativo completo permanece sob GPL. Não se deve copiar ou incorporar componentes sem avaliar a obrigação aplicável ao produto e à distribuição.

## Geração de imagens: estado honesto e proteção contra custos

O código não presume que exista um modelo de imagens gratuito. O endpoint verifica a configuração no servidor e expõe um estado sem revelar chaves.

- OPENROUTER_FREE_IMAGE_MODEL: somente um modelo real confirmado como compatível com :free; custo positivo retornado pelo provedor faz a requisição falhar.
- OPENROUTER_IMAGE_MODEL: modelo remoto configurado opcionalmente.
- ORBIT_IMAGE_BILLING_ENABLED=false: padrão. Mesmo que um modelo pago esteja definido, ele não será chamado.
- Para autorizar modelos faturáveis, o administrador precisa definir ORBIT_IMAGE_BILLING_ENABLED=true no servidor. Na interface, cada geração/edição remota ainda exige uma confirmação visível ao usuário.
- OPENROUTER_API_KEY permanece exclusivamente no servidor. Não usar prefixo VITE_.
- REAL_ESRGAN_ENDPOINT é opcional; precisa apontar para um processador realmente implantado. O endpoint de aprimoramento local do navegador é independente e não requer esse serviço.

A UI não pode afirmar “gerando perfeitamente” quando falta endpoint/modelo/chave. Ela deve explicar a configuração ausente. A equipe deve testar ao menos uma geração real no ambiente implantado, verificar o modelo de resposta/limites e observar logs de custo antes de declarar a integração pronta.

## Flaticon / Uicons

Os ícones Uicons são fornecidos pela stylesheet oficial do Flaticon. Manter a atribuição visível “Uicons by Flaticon” conforme os termos de uso aplicáveis e não distribuir arquivos de fontes de ícones como se fossem ativos próprios. O layout mantém componentes de fallback com ícones Tabler para evitar áreas vazias caso o CDN do Flaticon não carregue.

## Plano de validação

1. bun run lint, bun run typecheck, bun run test e bun run build.
2. Validar rotas antigas do Word/Excel/PowerPoint abrindo o leitor e não os editores.
3. Usar fixtures DOCX/XLSX/PPTX/EPUB/PDF para confirmar conteúdo visualizado e origem preservada.
4. Testar player com fixtures MP4/H.264/AAC e WebM/VP8/VP9, uma legenda VTT e SRT, playlist, retomar reprodução, PiP e URL remota autorizada; testes não devem alegar suporte a codecs que não foram testados.
5. Testar o estúdio de imagens com credenciais e modelo reais em ambiente controlado; confirmar falha fechada sem configuração e confirmação antes de qualquer chamada faturável.
6. Construir e instalar APK Android em dispositivo real. A montagem do APK não é teste suficiente da reprodução de cada codec.


## Referências públicas para verificação

- VLC Android, repositório oficial e licenciamento: https://github.com/videolan/vlc-android
- Documentação do VLC para Android: https://docs.videolan.me/vlc-android/
- OpenRouter, catálogo de modelos de geração de imagens: https://openrouter.ai/docs/api/api-reference/images/list-image-models
- OpenRouter, geração de imagens e preços: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
- Flaticon Uicons, biblioteca e instruções de atribuição: https://www.flaticon.com/uicons
