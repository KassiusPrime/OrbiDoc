import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];
const warnings = [];

const google = read('src/services/googleAuthDrive.ts');
const microsoft = read('src/services/microsoftAuthOffice.ts');
const github = read('src/services/githubProjects.ts');
const githubApi = read('api/github/oauth-token.ts');
const linked = read('src/services/linkedAccounts.ts');

const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(google.includes('sessionStorage.setItem(STORAGE_KEY_USER'), 'Google Drive não mantém a sessão transitória em sessionStorage.');
expect(google.includes('localStorage.removeItem(STORAGE_KEY_USER)'), 'Migração Google não remove token legado do localStorage.');
expect(google.includes('https://www.googleapis.com/auth/drive.file'), 'Google Drive não usa o scope mínimo drive.file.');
expect(!google.includes("'https://www.googleapis.com/auth/drive'"), 'Google Drive solicita o scope amplo auth/drive.');
expect(google.includes('google.accounts.oauth2.initTokenClient'), 'Google Drive não usa Google Identity Services.');

expect(microsoft.includes("response_type', 'code'"), 'Microsoft OAuth não usa Authorization Code.');
expect(microsoft.includes("code_challenge_method', 'S256'"), 'Microsoft OAuth não usa PKCE S256.');
expect(microsoft.includes("grant_type: 'authorization_code'"), 'Microsoft não troca authorization code explicitamente.');
expect(microsoft.includes('sessionStorage.setItem(STORAGE_KEY_MS'), 'Microsoft persiste token fora da sessão transitória esperada.');
expect(microsoft.includes('localStorage.removeItem(STORAGE_KEY_MS)'), 'Microsoft não remove token legado do localStorage.');

expect(github.includes("fetch('/api/github/oauth-token'"), 'GitHub não delega troca de código/refresh token ao backend.');
expect(github.includes('sessionStorage.setItem(STORAGE_KEY'), 'GitHub não mantém credencial em sessão transitória.');
expect(!github.includes('localStorage.setItem(STORAGE_KEY,'), 'GitHub persiste token sensível no localStorage.');
expect(github.includes('/user/installations?per_page=100'), 'GitHub não limita o acesso aos repositórios autorizados via instalação do GitHub App.');
expect(github.includes('permissions?.push'), 'Escrita GitHub não verifica permissão antes de editar.');

expect(githubApi.includes('GITHUB_CLIENT_SECRET'), 'Troca OAuth GitHub não exige secret server-side.');
expect(githubApi.includes('sameOriginRequest'), 'Endpoint OAuth GitHub não valida origem.');
expect(githubApi.includes("Cache-Control', 'no-store'"), 'Endpoint OAuth GitHub não desabilita cache da resposta de token.');

expect(!linked.includes('accessToken:'), 'Registro persistente de contas vinculadas contém accessToken.');
expect(!linked.includes('refreshToken:'), 'Registro persistente de contas vinculadas contém refreshToken.');
expect(linked.includes('LinkedAccountRecord'), 'Camada de metadados de contas vinculadas está ausente.');

if (!google.includes('initCodeClient')) {
  warnings.push('Google Drive usa o token model moderno do Google Identity Services para acesso browser-only. Se o Orbit migrar o Drive para sessão server-side, preferir authorization code no backend e cookie seguro; não voltar ao implicit redirect legado.');
}

if (failures.length) {
  console.error('\nFalhas de segurança de contas/conectores:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Orbit Accounts: Microsoft usa Authorization Code + PKCE S256; Google usa drive.file e remove tokens persistentes do localStorage; GitHub usa GitHub App + troca server-side.');
console.log('Orbit Accounts: linkedAccounts sincroniza somente metadados não secretos.');
warnings.forEach((warning) => console.log(`Aviso: ${warning}`));
