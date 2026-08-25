import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

test('Firebase signup validates the live password policy before account creation', () => {
  const firebase = read('src/services/firebase.ts');
  assert.match(firebase, /validatePassword/);
  assert.match(firebase, /enforceCloudPasswordPolicy/);
  assert.match(firebase, /containsLowercaseLetter/);
  assert.match(firebase, /containsUppercaseLetter/);
  assert.match(firebase, /containsNumericCharacter/);
  assert.match(firebase, /containsNonAlphanumericCharacter/);
  assert.ok(firebase.indexOf('await enforceCloudPasswordPolicy(password)') < firebase.indexOf('createUserWithEmailAndPassword(auth, cleanEmail, password)'));
});

test('Firebase production workflow deploys and verifies auth before Firestore rules', () => {
  const workflow = read('.github/workflows/firebase-production.yml');
  const config = JSON.parse(read('firebase-applet-config.json')) as { firestoreDatabaseId: string };
  const authDeploy = workflow.indexOf('--only auth');
  const strictVerify = workflow.indexOf('ORBIDOC_REQUIRE_PASSWORD_AUTH');
  const firestoreDeploy = workflow.indexOf(`firestore:${config.firestoreDatabaseId}`);
  assert.ok(authDeploy >= 0);
  assert.ok(strictVerify > authDeploy);
  assert.ok(firestoreDeploy > strictVerify);
  assert.match(workflow, /FIREBASE_SERVICE_ACCOUNT_JSON/);
  assert.match(workflow, /docs\/FIREBASE_AUTH_SETUP\.md/);
});

test('Firebase production setup guide documents manual and GitHub Actions paths', () => {
  const guide = read('docs/FIREBASE_AUTH_SETUP.md');
  assert.match(guide, /gen-lang-client-0703075207/);
  assert.match(guide, /Security → Authentication/);
  assert.match(guide, /Email\/Password/);
  assert.match(guide, /roles\/firebaseauth\.admin/);
  assert.match(guide, /roles\/firebaserules\.admin/);
  assert.match(guide, /FIREBASE_SERVICE_ACCOUNT_JSON/);
  assert.match(guide, /ORBIDOC_REQUIRE_PASSWORD_AUTH=true/);
});