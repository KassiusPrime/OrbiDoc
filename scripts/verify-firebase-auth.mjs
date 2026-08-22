import fs from 'node:fs/promises';

const config = JSON.parse(await fs.readFile('firebase-applet-config.json', 'utf8'));
if (!config.apiKey || !config.projectId || !config.authDomain) {
  throw new Error('Firebase config incompleta: apiKey/projectId/authDomain ausentes.');
}

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
if (code.includes('OPERATION_NOT_ALLOWED') || code.includes('CONFIGURATION_NOT_FOUND')) {
  throw new Error(`Firebase Authentication por e-mail/senha não está habilitado: ${code}`);
}
if (!/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD|USER_DISABLED/.test(code)) {
  throw new Error(`Resposta inesperada do Firebase Authentication (${response.status}): ${code || 'sem código'}`);
}

console.log(`Firebase Authentication está acessível e o provedor e-mail/senha responde corretamente (${code}).`);
