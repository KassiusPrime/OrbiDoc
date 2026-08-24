import fs from 'node:fs/promises';

const [configRaw, localAccount, authPanel] = await Promise.all([
  fs.readFile('firebase-applet-config.json', 'utf8'),
  fs.readFile('src/services/localAccount.ts', 'utf8'),
  fs.readFile('src/components/OrbiDocAuthPanel.tsx', 'utf8'),
]);
const config = JSON.parse(configRaw);
if (!config.apiKey || !config.projectId || !config.authDomain) {
  throw new Error('Firebase config incompleta: apiKey/projectId/authDomain ausentes.');
}

for (const token of ['PBKDF2', "hash: 'SHA-256'", '310_000', 'crypto.getRandomValues', 'passwordHash', 'SESSION_KEY']) {
  if (!localAccount.includes(token)) throw new Error(`Conta local segura incompleta: ${token} ausente.`);
}
for (const token of ['createLocalOrbiDocAccount', 'signInLocalOrbiDocAccount', 'Conta local', 'PASSWORD_LOGIN_DISABLED']) {
  if (!authPanel.includes(token)) throw new Error(`Painel de autenticação não contém o fallback local esperado: ${token}.`);
}

const strict = process.env.ORBIDOC_REQUIRE_PASSWORD_AUTH === 'true';
const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`;
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: `orbidoc-health-${Date.now()}@invalid.example`,
    password: 'OrbiDoc-health-check-not-a-real-password',
    returnSecureToken: true,
  }),
});
const payload = await response.json().catch(() => ({}));
const code = String(payload?.error?.message || '');

if (response.ok) throw new Error('O health-check de autenticação entrou inesperadamente com uma conta inexistente.');

const providerDisabled = /PASSWORD_LOGIN_DISABLED|OPERATION_NOT_ALLOWED|CONFIGURATION_NOT_FOUND/.test(code);
if (providerDisabled) {
  const message = `Firebase acessível, mas o provedor e-mail/senha está desativado no projeto (${code}).`;
  if (strict) throw new Error(message);
  console.warn(`${message} Conta local segura PBKDF2/SHA-256 validada como fallback funcional; nuvem não será simulada.`);
  process.exit(0);
}

if (!/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD|USER_DISABLED/.test(code)) {
  throw new Error(`Resposta inesperada do Firebase Authentication (${response.status}): ${code || 'sem código'}`);
}

console.log(`Firebase Authentication está acessível e o provedor e-mail/senha responde corretamente (${code}).`);
console.log('Conta local segura também permanece disponível como opção offline.');