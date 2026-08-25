import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(path, 'utf8');

test('OrbiDoc uses a branded Firebase email action handler for verification and password reset', async () => {
  const [main, page, service] = await Promise.all([
    read('src/main.tsx'),
    read('src/components/OrbiDocAuthActionPage.tsx'),
    read('src/services/firebaseEmailActions.ts'),
  ]);
  assert.match(main, /normalizedPath === '\/auth\/action'/);
  assert.match(main, /<OrbiDocAuthActionPage/);
  assert.match(service, /applyActionCode/);
  assert.match(service, /confirmPasswordReset/);
  assert.match(service, /target\.origin !== window\.location\.origin/);
  assert.match(page, /Código de uso único validado diretamente pelo Firebase/);
});

test('premium entitlements are kept in Firestore instead of localStorage', async () => {
  const service = await read('src/services/entitlements.ts');
  assert.match(service, /doc\(db, 'entitlements', user\.uid\)/);
  assert.match(service, /plan === 'supreme'/);
  assert.match(service, /role === 'owner'/);
  assert.doesNotMatch(service, /localStorage/);
});

test('Firestore rules prevent users from self-promoting and bootstrap owner access from console', async () => {
  const rules = await read('firestore.rules');
  assert.match(rules, /match \/entitlements\/\{userId\}/);
  assert.match(rules, /allow create, update, delete: if isOwner\(\)/);
  assert.match(rules, /get\(entitlementPath\(request\.auth\.uid\)\)\.data\.role == 'owner'/);
  assert.match(rules, /match \/admin_audit\/\{auditId\}/);
});

test('Supreme console is owner-only and writes audited entitlements', async () => {
  const [consoleSource, adminService] = await Promise.all([
    read('src/components/AdminConsoleLauncher.tsx'),
    read('src/services/adminEntitlements.ts'),
  ]);
  assert.match(consoleSource, /if \(!owner\) return null/);
  assert.match(consoleSource, /SUPREME/);
  assert.match(adminService, /entitlement\.upsert/);
  assert.match(adminService, /admin_audit/);
  assert.match(adminService, /Esta operação exige o papel owner/);
});

test('Android BYOK is gated by Premium and never represented as a free entitlement', async () => {
  const launcher = await read('src/components/NativeAiSettingsLauncher.tsx');
  assert.match(launcher, /hasOrbiDocFeature\(entitlement, 'ai\.byok'\)/);
  assert.match(launcher, /BYOK é um recurso Premium/);
  assert.match(launcher, /Android Keystore/);
  assert.match(launcher, /orbidoc:open-pricing/);
});

test('pricing foundation distinguishes Stripe web checkout from Google Play billing without fake purchases', async () => {
  const pricing = await read('src/components/PricingLauncher.tsx');
  assert.match(pricing, /Assinar pelo Google Play/);
  assert.match(pricing, /Assinar no OrbiDoc Web/);
  assert.match(pricing, /checkout será Stripe/);
  assert.match(pricing, /Play Billing/);
  assert.match(pricing, /disabled/);
});
