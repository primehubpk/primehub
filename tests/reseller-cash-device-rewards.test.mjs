import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

const fakeDb = { collection() { throw new Error('Unit tests cannot access real Firestore'); } };
function loadTS(path, mapping = {}, env = {}) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require(name) {
      if (name === 'server-only') return {};
      if (name === 'node:crypto') return crypto;
      if (name === 'firebase-admin/firestore') return { FieldValue: {} };
      if (name === '@/lib/firebaseAdmin') return { getAdminDb: () => fakeDb };
      if (name === '@/lib/resellerDualMirror') return { mirrorResellerFirestoreDoc() { throw new Error('No DB calls expected in tests'); } };
      if (mapping[name]) return mapping[name];
      throw new Error('Unexpected import ' + name);
    },
    process: { env }, Date, Buffer, URL, URLSearchParams,
    TextEncoder, console, setTimeout, AbortSignal, fetch: () => { throw new Error('No network requests permitted in unit tests'); },
  }, { filename: path });
  return exports;
}

const wallet = loadTS('lib/resellerShoppingCheckout.ts');
test('Shopping first then withdrawable, never double-spending money', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(wallet.allocateShoppingCash(400, 500, 700))),
    { shoppingApplied: 400, withdrawableApplied: 300, amount: 700, amountDue: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(wallet.allocateShoppingCash(0, 100, 200))),
    { shoppingApplied: 0, withdrawableApplied: 100, amount: 100, amountDue: 100 });
  assert.deepEqual(JSON.parse(JSON.stringify(wallet.allocateShoppingCash(300, 0, 100))),
    { shoppingApplied: 100, withdrawableApplied: 0, amount: 100, amountDue: 0 });
  assert.throws(() => wallet.allocateShoppingCash(-1, 0, 100), /Invalid shopping/);
  assert.throws(() => wallet.allocateShoppingCash(100, Infinity, 100), /Invalid shopping/);
  assert.throws(() => wallet.allocateShoppingCash(100, 100, 0), /Invalid shopping/);
});

const bonus = loadTS('lib/playInstallBonus.ts', {},
  { PLAY_INSTALL_BONUS_ENABLED: 'true', PLAY_BONUS_DEVICE_HMAC_SECRET: 'very-long-secret-string-that-meets-minimum', FIREBASE_SERVICE_ACCOUNT_KEY: '{}' });
test('Hash app-scoped Android ID on server, never store IMEI or raw Android ID', () => {
  const one = bonus.deviceDigest('a1b2c3d4e5f60001');
  assert.match(one, /^[a-f0-9]{64}$/);
  assert.equal(one, bonus.deviceDigest('A1B2C3D4E5F60001'));
  assert.notEqual(one, bonus.deviceDigest('a1b2c3d4e5f60002'));
  assert.ok(!one.includes('a1b2c3'));
  assert.throws(() => bonus.deviceDigest('356789012345678'), /Invalid Android/); // IMEI is not acceptable
});
test('Play Integrity verdict must verify app package, license, device, nonce and freshness', () => {
  const now = Date.now();
  const valid = {
    requestDetails: { requestPackageName: 'com.primehubmall.app', nonce: 'test-nonce', timestampMillis: String(now) },
    appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
    accountDetails: { appLicensingVerdict: 'LICENSED' },
    deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] },
  };
  assert.doesNotThrow(() => bonus.validateBonusVerdict(valid, 'test-nonce', now));
  for (const change of [
    { ...valid, requestDetails: { ...valid.requestDetails, nonce: 'different' } },
    { ...valid, requestDetails: { ...valid.requestDetails, timestampMillis: String(now - 360000) } },
    { ...valid, requestDetails: { ...valid.requestDetails, requestPackageName: 'fake.app' } },
    { ...valid, appIntegrity: { appRecognitionVerdict: 'UNRECOGNIZED_VERSION' } },
    { ...valid, accountDetails: { appLicensingVerdict: 'UNLICENSED' } },
    { ...valid, deviceIntegrity: { deviceRecognitionVerdict: [] } },
    { ...valid, deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'], deviceRecall: { values: { bitFirst: true } } } },
  ]) assert.throws(() => bonus.validateBonusVerdict(change, 'test-nonce', now));
});
test('No App Bonus cash can be paid when feature is not explicitly enabled', () => {
  const off = loadTS('lib/playInstallBonus.ts');
  assert.equal(off.bonusIsEnabled(), false);
});

const spin = loadTS('lib/resellerSpinGuard.ts');
test('Different account ids do not reset same-browser daily spin lock key', () => {
  const first = spin.spinKey('g_5c269824fc03462491a3f56418afc001', '2026-10-14');
  const second = spin.spinKey('g_5c269824fc03462491a3f56418afc001', '2026-10-14');
  assert.equal(first, second);
  assert.notEqual(first, spin.spinKey('g_5c269824fc03462491a3f56418afc001', '2026-10-15'));
  assert.notEqual(first, spin.spinKey('g_otherbrowsernonce', '2026-10-14'));
});
test('No IMEI permissions in Android app; genuine-install proof only on explicit native reward claim', () => {
  const manifest = fs.readFileSync('play-store/android-twa/app/src/main/AndroidManifest.xml', 'utf8');
  const bridge = fs.readFileSync('play-store/android-twa/app/src/main/java/com/primehubmall/app/PushManager.java', 'utf8');
  const manager = fs.readFileSync('play-store/android-twa/app/src/main/java/com/primehubmall/app/PlayBonusManager.java', 'utf8');
  assert.ok(!manifest.includes('READ_PHONE_STATE'));
  assert.ok(!manifest.includes('READ_PRIVILEGED_PHONE_STATE'));
  assert.ok(manager.includes('Settings.Secure.ANDROID_ID'));
  assert.ok(manager.includes('IntegrityManagerFactory.create'));
  assert.ok(bridge.includes('"playBonus".equals(action)'));
  assert.ok(!manager.includes('TelephonyManager'));
  assert.ok(!manager.includes('getImei()'));
});
