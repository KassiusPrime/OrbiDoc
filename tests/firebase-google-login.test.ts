import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const googleAuth = fs.readFileSync('src/services/firebaseGoogleAuth.ts', 'utf8');
const authPanel = fs.readFileSync('src/components/OrbitAuthPanel.tsx', 'utf8');
const loginScreen = fs.readFileSync('src/components/OrbiDocLoginScreen.tsx', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');

test('Orbit Google login uses Firebase Authentication without requesting Drive access', () => {
  assert.match(googleAuth, /GoogleAuthProvider/);
  assert.match(googleAuth, /signInWithPopup\(auth, googleProvider\(\)\)/);
  assert.match(googleAuth, /prompt: 'select_account'/);
  assert.doesNotMatch(googleAuth, /drive\.file|googleAuthDrive|www\.googleapis\.com\/auth\/drive/);
});

test('Google-only accounts can reauthenticate before account deletion', () => {
  assert.match(googleAuth, /reauthenticateWithPopup\(user, googleProvider\(\)\)/);
  assert.match(googleAuth, /deleteOrbiDocGoogleAccountAndCloudData/);
  assert.match(authPanel, /isCurrentOrbiDocGoogleUser/);
  assert.match(authPanel, /deleteOrbiDocGoogleAccountAndCloudData/);
});

test('Account panel exposes Google as a first-class Orbit login method', () => {
  assert.match(authPanel, /Continuar com Google/);
  assert.match(authPanel, /signInOrbiDocWithGoogle/);
  assert.match(authPanel, /Google autentica a Conta Orbit/);
});

test('Dedicated login screen is mounted globally and preserves local-first access', () => {
  assert.match(loginScreen, /Entrar ou criar Conta Orbit/);
  assert.match(loginScreen, /Continuar sem conta/);
  assert.match(loginScreen, /showBackupControls=\{false\}/);
  assert.match(loginScreen, /orbit_auth_entry_v1/);
  assert.match(loginScreen, /orbidoc_auth_entry_v1/);
  assert.match(main, /<OrbiDocLoginScreen \/>/);
});

test('Native runtime fails explicitly instead of pretending web popup auth works in the APK', () => {
  assert.match(googleAuth, /isOrbiDocNativeRuntime\(\)/);
  assert.match(googleAuth, /registrar o app Android e a impressão SHA no Firebase/);
});
