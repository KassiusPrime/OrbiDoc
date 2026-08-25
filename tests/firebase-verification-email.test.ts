import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const firebaseService = fs.readFileSync('src/services/firebase.ts', 'utf8');
const authPanel = fs.readFileSync('src/components/OrbiDocAuthPanel.tsx', 'utf8');

test('Firebase account creation never swallows verification email failures', () => {
  assert.doesNotMatch(firebaseService, /sendEmailVerification\([^)]*\)\.catch\(\(\) => undefined\)/);
  assert.match(firebaseService, /Conta em nuvem criada, mas o Firebase não conseguiu enviar o e-mail de verificação/);
  assert.match(firebaseService, /Use “Reenviar” na conta para tentar novamente/);
});

test('Firebase verification resend surfaces actionable errors', () => {
  assert.match(firebaseService, /Não foi possível reenviar o e-mail de verificação/);
  assert.match(firebaseService, /auth\/quota-exceeded/);
  assert.match(firebaseService, /auth\/unauthorized-continue-uri/);
  assert.match(firebaseService, /auth\/unauthorized-domain/);
  assert.match(firebaseService, /auth\/internal-error/);
});

test('Cloud account UI keeps an explicit resend control for unverified users', () => {
  assert.match(authPanel, /E-mail ainda não verificado/);
  assert.match(authPanel, /resendOrbiDocVerification/);
  assert.match(authPanel, />Reenviar<\/button>/);
});
