import fs from 'node:fs/promises';

const read = (path) => fs.readFile(path, 'utf8');
const [main, reader, github, nexus, bottomNav, webllm, platform, viewportAgent, windowScript] = await Promise.all([
  read('src/AppV5.tsx'),
  read('src/components/ReaderWorkspace.tsx'),
  read('src/components/GitHubProjectsWorkspace.tsx'),
  read('src/components/AiWorkspace.tsx'),
  read('src/components/BottomNavBar.tsx'),
  read('src/ai/webllm.ts'),
  read('src/platform.css'),
  read('src/components/NativeViewportAgent.tsx'),
  read('scripts/configure-native-android-window.mjs'),
]);

const assertions = [
  [main.includes('ReaderWorkspace'), 'App principal não está centrado no ReaderWorkspace.'],
  [main.includes('AiWorkspace') && main.includes('Nexus AI'), 'Nexus AI não está integrado ao shell principal.'],
  [main.includes('Local · WebLLM / Ollama'), 'Shell não comunica a arquitetura local WebLLM/Ollama.'],
  [reader.includes('arquivos locais + GitHub'), 'Leitor não declara suas duas fontes principais.'],
  [reader.includes('Perguntar ao Nexus'), 'Leitor não oferece entrada direta no Nexus.'],
  [reader.includes('iframe') && reader.includes('audio') && reader.includes('video'), 'Leitor não possui superfícies básicas para PDF/mídia.'],
  [github.includes('Somente leitura'), 'Integração GitHub não está em modo somente leitura.'],
  [github.includes('listGitHubRepositories') && github.includes('loadGitHubRepositoryTree'), 'Leitor GitHub não lista repositórios/árvore.'],
  [github.includes('downloadGitHubRepository'), 'Leitor GitHub não oferece download do repositório.'],
  [!github.includes('saveGitHubTextFile'), 'Leitor GitHub ainda contém caminho de escrita.'],
  [nexus.includes('Virtuoso'), 'Nexus AI não virtualiza a conversa.'],
  [nexus.includes('placeholder="Pergunte alguma coisa"'), 'Composer do Nexus não está presente.'],
  [nexus.includes('orbit:nexus-context'), 'Nexus não recebe contexto do leitor.'],
  [webllm.includes('WebGPU') && webllm.includes('webllm.worker.ts'), 'Runtime WebLLM não está protegido por Web Worker/WebGPU.'],
  [webllm.includes('Llama-3.2-1B-Instruct-q4f16_1-MLC'), 'Modelo WebLLM móvel não está definido.'],
  [webllm.includes('indexeddb'), 'WebLLM não usa cache persistente apropriado para modelo local.'],
  [bottomNav.includes("label: 'Arquivos'") && bottomNav.includes("label: 'Assistente'") && !bottomNav.includes("label: 'Criar'") && !bottomNav.includes("label: 'Apps'"), 'Bottom navigation não mantém o shell mínimo do leitor.'],
  [!bottomNav.includes("label: 'Criar'"), 'Bottom navigation ainda expõe criação de arquivos.'],
  [!main.includes('Criar agora') && !main.includes('Criar no OrbiDoc'), 'App principal ainda expõe ações de criação.'],
  [platform.includes('safe-area-inset-top') && platform.includes('safe-area-inset-bottom'), 'Safe areas mobile não estão protegidas.'],
  [viewportAgent.includes('window.visualViewport'), 'visualViewport não está sendo observado.'],
  [windowScript.includes('SOFT_INPUT_ADJUST_RESIZE'), 'Android não usa adjustResize para o teclado.'],
];

const failures = assertions.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) throw new Error(`Auditoria mobile/reader falhou:\n- ${failures.join('\n- ')}`);
console.log('Orbit Reader audit OK: reader-first shell, read-only GitHub, Nexus context bridge, WebLLM worker, local caching, mobile navigation and safe-area protections are wired.');
