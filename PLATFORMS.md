# OrbiDoc Platforms

O OrbiDoc deve permanecer um único produto, com um único núcleo de editores e dados, distribuído em três experiências.

## 1. Web

Base atual: Vite + React + Vercel.

Responsabilidades:
- acesso por URL sem instalação;
- criação/edição completa;
- conta OrbiDoc via Firebase Authentication;
- integração opcional com serviços externos;
- atualizações imediatas;
- fallback local-first.

## 2. Mobile

Base atual: PWA instalável + WebAPK/TWA.

O perfil `mobile` é detectado pelo runtime e adapta:
- áreas de toque;
- safe areas;
- navegação inferior;
- scanner e câmera traseira;
- densidade visual;
- gestos e scroll;
- modo standalone.

### Android

Fase 1: instalação normal pelo Chrome/PWA.

Fase 2: TWA/AAB usando `ANDROID_PACKAGE_NAME` e `ANDROID_SHA256_CERT_FINGERPRINT`.

A lógica do app continua a mesma. O pacote Android é apenas o shell de distribuição.

### iOS

Distribuição inicial como PWA adicionada à Tela de Início. Recursos dependentes de APIs específicas devem sempre possuir fallback de navegador.

## 3. Desktop

Base atual: PWA standalone, com `display_override: ["window-controls-overlay", "standalone"]`.

Isso já permite uma experiência de aplicativo separada do navegador sem manter outro frontend.

### Desktop nativo futuro

Quando o core PWA estiver estável, empacotar com Tauri 2:
- Windows: `.msi` / `.exe`;
- macOS: `.app` / `.dmg`;
- Linux: AppImage/deb/rpm conforme necessidade.

O wrapper Tauri deve reutilizar o build web e adicionar apenas capacidades nativas que tragam valor real, por exemplo:
- abrir/salvar arquivos pelo sistema;
- associação de extensões;
- drag & drop nativo;
- acesso a diretórios escolhidos pelo usuário;
- menu de aplicativo;
- atualização automática;
- impressão e exportação nativa;
- integração com compartilhamento do sistema.

## Regra de arquitetura

Não criar três cópias dos editores.

```text
OrbiDoc Core
├── Documentos
├── Planilhas
├── Apresentações
├── Design
├── Scan & Reader
├── PDF/OCR
├── Conversor
├── IA
├── Conta / Sync
└── Histórico de versões

        ↓

Web Shell     Mobile Shell     Desktop Shell
Vercel        PWA/TWA          PWA/Tauri
```

## Detecção atual

`src/lib/platformProfile.ts` atribui:
- `data-orbidoc-platform="web"`
- `data-orbidoc-platform="mobile"`
- `data-orbidoc-platform="desktop"`

`src/platform.css` aplica diferenças de interação sem alterar lógica de documento.

## Ordem recomendada de evolução

1. estabilizar PR do workspace profissional;
2. validar autenticação real Email/Password no Firebase;
3. implementar sync seletivo e conflitos;
4. concluir file-open/reader/scanner;
5. publicar PWA web/mobile;
6. assinar Android TWA/AAB;
7. empacotar Tauri para desktop;
8. adicionar capacidades nativas somente quando não houver equivalente web confiável.
