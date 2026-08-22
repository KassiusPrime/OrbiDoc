import fs from 'node:fs/promises';

const config = JSON.parse(await fs.readFile('firebase-applet-config.json', 'utf8'));
if (!config.apiKey || !config.projectId || !config.authDomain) {
  throw new Error('Firebase config incompleta: apiKey/projectId/authDomain ausentes.');
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

if (response.ok) {
  throw new Error('O health-check de autenticação entrou inesperadamente com uma conta inexistente.');
}

const providerDisabled = /PASSWORD_LOGIN_DISABLED|OPERATION_NOT_ALLOWED|CONFIGURATION_NOT_FOUND/.test(code);
if (providerDisabled) {
  const message = `Firebase acessível, mas o provedor e-mail/senha está desativado no projeto (${code}).`;
  if (strict) throw new Error(message);
  console.warn(`${message} O app continuará local-first; o formulário informará este estado sem fingir que o login está ativo.`);
  process.exit(0);
}

if (!/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD|USER_DISABLED/.test(code)) {
  throw new Error(`Resposta inesperada do Firebase Authentication (${response.status}): ${code || 'sem código'}`);
}

console.log(`Firebase Authentication está acessível e o provedor e-mail/senha responde corretamente (${code}).`);
