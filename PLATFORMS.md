# OrbiDoc Platforms

O OrbiDoc permanece um único produto com um único núcleo de editores e dados, porém agora possui **quatro superfícies de experiência distintas**. Não são quatro frontends duplicados: o core é compartilhado e o shell/layout muda conforme o ambiente.

## 1. Web

Base: Vite + React + Vercel, aberto em navegador de desktop/notebook sem instalação.

Perfil: `data-orbidoc-platform="web"`.

Prioridades:
- espaço de trabalho amplo;
- sidebar e painéis simultâneos quando houver largura;
- recursos online opcionais;
- instalação PWA disponível;
- atualização imediata pelo deploy.

## 2. Mobile Web

Base: o mesmo site aberto em navegador móvel, sem ser o APK nativo.

Perfil: `data-orbidoc-platform="mobile"`.

Prioridades:
- navegação inferior e ações de polegar;
- controles compactos, mas com alvo de toque seguro;
- teclado virtual e `visualViewport`;
- safe areas, notch, barras de gesto e orientação;
- overlays em bottom-sheet/full-screen;
- nenhuma ferramenta flutuante competindo com a hotbar.

**Importante:** Mobile Web não é mais sinônimo de Android nativo.

## 3. App nativo

### Android — distribuição principal

Base: **Capacitor 8 + build Vite empacotado dentro do APK/AAB**.

Perfil: `data-orbidoc-platform="app"` e `data-orbidoc-native="true"`.

O app herda o baseline de segurança de toque/safe-area do mobile, mas recebe uma classe própria (`orbidoc-platform-app`) para diferenças nativas. Assim, regras específicas do APK não contaminam o navegador móvel e vice-versa.

Prioridades adicionais do App:
- ponte nativa para salvar/abrir arquivos;
- intents Android / “Abrir com”;
- acesso ao arquivo recebido pelo sistema;
- downloads fora da sandbox do WebView quando autorizado;
- integração com status/navigation bars;
- densidade e superfícies próprias do app instalado;
- service worker PWA desativado dentro do Capacitor.

O Android nativo contém `dist/` no pacote. `capacitor.config.json` não usa `server.url`, portanto o workspace básico não depende de uma hospedagem web para iniciar.

### Saídas Android

1. **APK debug** — testes diretos.
2. **APK release assinado** — distribuição direta.
3. **AAB release assinado** — lojas como Google Play.

O workflow `.github/workflows/android-native.yml` gera/valida essas saídas. Release exige keystore permanente em secrets.

### iOS

A experiência atual pode ser PWA; um shell Capacitor iOS pode reutilizar o mesmo core no futuro, recebendo o mesmo perfil `app` com `data-orbidoc-native-platform="ios"`.

## 4. Desktop instalado

Base atual: PWA standalone, incluindo `window-controls-overlay` quando suportado.

Perfil: `data-orbidoc-platform="desktop"`.

Prioridades:
- janela redimensionável sem largura mínima rígida;
- scrollbar estável;
- densidade um pouco maior que a web normal;
- affordances de mouse/trackpad;
- atalhos de teclado;
- associação de arquivos PWA quando suportada pelo SO/navegador.

### Desktop nativo futuro

Tauri 2 pode empacotar o mesmo core se houver necessidade de integração ainda mais profunda:
- Windows `.msi/.exe`;
- macOS `.app/.dmg`;
- Linux AppImage/deb/rpm.

## Modificadores de entrada e formato

Além da superfície principal, `src/lib/platformProfile.ts` publica dois eixos independentes:

### Entrada
- `data-orbidoc-input="touch"`
- `data-orbidoc-input="pointer"`

### Form factor
- `data-orbidoc-form-factor="phone"`
- `data-orbidoc-form-factor="tablet"`
- `data-orbidoc-form-factor="wide"`

Isso evita erros como classificar um tablet Android como desktop somente pela largura, ou aplicar UX de telefone a uma janela PWA estreita com mouse.

## Universal File Opener

O OrbiDoc registra `file_handlers` na PWA e consome `window.launchQueue`. O bridge Android expõe o mesmo contrato para o frontend, permitindo que PWA/Desktop e App compartilhem o leitor sem duplicação.

Formatos atualmente reconhecidos incluem:
- PDF;
- DOCX;
- XLS/XLSX/ODS;
- PPTX (extração/preview textual local nesta etapa);
- EPUB;
- ZIP com inspeção interna;
- HTML/Markdown/texto/CSV/JSON/XML/YAML/TOML/SQL e vários formatos de código;
- imagens comuns.

O opener lê localmente, permite filtrar/buscar, copiar texto extraído e salvar uma cópia do original. Arquivos não suportados permanecem preservados; o app não tenta interpretar binários desconhecidos de forma insegura.

## Recursos naturalmente online e opcionais

- Firebase Authentication e sincronização;
- Google Drive;
- OneDrive/Microsoft Graph;
- GitHub privado via GitHub App;
- IA remota;
- Real-ESRGAN remoto;
- downloads por URL;
- atualizações do aplicativo.

Esses recursos não devem impedir o núcleo local de abrir.

## Regra de arquitetura

```text
OrbiDoc Core
├── Documentos / Planilhas / Apresentações
├── Design / PDF / OCR / Scanner
├── Universal File Opener
├── Conversão e mídia
├── Projetos / histórico / backup
├── Conta OrbiDoc
└── Conexões externas opcionais

       ↓ perfil de superfície

Web Browser     Mobile Browser     Desktop Installed     Native App
web             mobile             desktop               app
pointer/touch   touch              pointer               touch
wide/tablet     phone/tablet       wide/tablet           phone/tablet
```

Nenhum editor deve ser duplicado por plataforma; diferenças devem ficar em shell, CSS de superfície, bridges nativas e adaptadores de capacidade.
