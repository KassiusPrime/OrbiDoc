# OrbiDoc Platforms

O OrbiDoc deve permanecer um único produto, com um único núcleo de editores e dados, distribuído em experiências diferentes sem duplicar o frontend.

## 1. Web

Base: Vite + React + Vercel.

Responsabilidades:
- acesso por URL sem instalação;
- criação/edição completa;
- conta OrbiDoc opcional via Firebase Authentication;
- integração opcional com serviços externos;
- atualizações imediatas;
- fallback local-first.

A versão web continua existindo, mas **não é requisito para o Android nativo iniciar**.

## 2. Mobile

### Android — distribuição principal nativa

Base: **Capacitor 8 + build Vite empacotado dentro do APK/AAB**.

O Android nativo contém o conteúdo de `dist/` dentro do próprio pacote. Não existe `server.url` em `capacitor.config.json`, portanto o shell não aponta para uma hospedagem web para abrir o workspace.

O perfil `mobile` adapta:
- áreas de toque;
- safe areas;
- navegação inferior;
- scanner e câmera;
- densidade visual;
- gestos e scroll;
- armazenamento local;
- execução offline do núcleo.

O runtime detecta Capacitor e:
- marca `data-orbidoc-native="true"`;
- considera o aplicativo já instalado;
- esconde CTAs de instalação PWA;
- não registra service worker da PWA dentro do app nativo;
- usa worker/core/idiomas locais para OCR.

### Saídas Android

1. **APK debug** — instalável diretamente para testes, sem Play Store.
2. **APK release assinado** — instalável diretamente e apropriado para distribuição fora da loja.
3. **AAB release assinado** — formato destinado a lojas como Google Play.

O workflow `.github/workflows/android-native.yml` gera esses pacotes. A versão release exige secrets de assinatura; a chave privada nunca deve ser commitada.

### PWA Android — alternativa

A PWA/WebAPK continua disponível para quem preferir instalar pelo navegador. Ela não é mais a arquitetura principal do Android.

### iOS

Distribuição inicial como PWA adicionada à Tela de Início. Um shell Capacitor iOS pode ser acrescentado posteriormente usando o mesmo `dist/`, sem criar um frontend separado.

## 3. Desktop

Base atual: PWA standalone, com `display_override: ["window-controls-overlay", "standalone"]`.

Isso permite experiência separada do navegador sem manter outro frontend.

### Desktop nativo futuro

Quando necessário, empacotar com Tauri 2:
- Windows: `.msi` / `.exe`;
- macOS: `.app` / `.dmg`;
- Linux: AppImage/deb/rpm.

O wrapper Tauri deve reutilizar o mesmo build e adicionar apenas capacidades realmente nativas, por exemplo:
- abrir/salvar arquivos pelo sistema;
- associação de extensões;
- drag & drop nativo;
- acesso a diretórios escolhidos pelo usuário;
- menus do sistema;
- impressão e exportação nativa.

## Núcleo que deve funcionar sem servidor

Depois que o APK estiver instalado, o funcionamento básico não deve depender de Vercel, Firebase ou outro backend:

- Documentos;
- Planilhas;
- Apresentações;
- Design;
- scanner;
- processamento de imagem local;
- leitura de PDF/DOCX/XLSX/EPUB/ZIP/texto/imagens;
- OCR Português + Inglês empacotado no APK;
- histórico local e backup local;
- criação/edição/exportação local.

## Recursos naturalmente online e opcionais

Esses recursos podem usar Internet, mas **não podem impedir o app de abrir ou o núcleo local de funcionar**:

- geração/restauração por IA remota;
- Real-ESRGAN hospedado externamente;
- Firebase Authentication e sincronização em nuvem;
- Google Drive/OneDrive;
- baixar um arquivo de uma URL externa;
- atualizações do aplicativo.

## Regra de arquitetura

Não criar cópias independentes dos editores.

```text
OrbiDoc Core
├── Documentos
├── Planilhas
├── Apresentações
├── Design
├── Scan & Reader
├── PDF/OCR
├── Conversor
├── histórico / backup local
├── IA opcional
└── Conta / Sync opcional

        ↓

Web Shell          Android Native        Desktop Shell
Vite/PWA           Capacitor 8           PWA/Tauri
URL opcional       APK/AAB local         build compartilhado
```

## Detecção atual

`src/lib/platformProfile.ts` atribui:
- `data-orbidoc-platform="web"`
- `data-orbidoc-platform="mobile"`
- `data-orbidoc-platform="desktop"`

`src/lib/nativeRuntime.ts` adiciona:
- `data-orbidoc-native="true|false"`
- `data-orbidoc-native-platform="android|ios"` quando aplicável.

## Ordem recomendada

1. manter o core local estável;
2. validar o workflow de APK debug;
3. criar uma chave de assinatura permanente;
4. gerar APK release assinado;
5. testar instalação e atualização em Android real;
6. distribuir o APK diretamente quando desejado;
7. gerar AAB e publicar na Play Store somente se houver interesse;
8. manter recursos de nuvem/IA como complementos opcionais.