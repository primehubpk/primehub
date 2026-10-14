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

test('Combined Rs.300 shopping plus Rs.100 withdrawal cash auto-pays the whole Rs.400 first', () => {
  const full = JSON.parse(JSON.stringify(wallet.allocateShoppingCash(300, 100, 400)));
  assert.deepEqual(full, { shoppingApplied: 300, withdrawableApplied: 100, amount: 400, amountDue: 0 });
  const partial = JSON.parse(JSON.stringify(wallet.allocateShoppingCash(300, 100, 700)));
  assert.deepEqual(partial, { shoppingApplied: 300, withdrawableApplied: 100, amount: 400, amountDue: 300 });
  const small = JSON.parse(JSON.stringify(wallet.allocateShoppingCash(300, 100, 250)));
  assert.deepEqual(small, { shoppingApplied: 250, withdrawableApplied: 0, amount: 250, amountDue: 0 });
  const cashOnly = JSON.parse(JSON.stringify(wallet.allocateShoppingCash(0, 100, 90)));
  assert.deepEqual(cashOnly, { shoppingApplied: 0, withdrawableApplied: 90, amount: 90, amountDue: 0 });
});

test('Checkout automatically uses wallet balance without checkbox or repeated wallet quote', () => {
  const client = fs.readFileSync('components/checkout/useCheckout.ts', 'utf8');
  const page = fs.readFileSync('app/checkout/page.tsx', 'utf8');
  const summary = fs.readFileSync('components/checkout/CheckoutSummary.tsx', 'utf8');
  const actions = fs.readFileSync('components/checkout/CheckoutActions.tsx', 'utf8');
  const backend = fs.readFileSync('app/api/orders/route.ts', 'utf8');
  assert.ok(client.includes("const useShoppingCredit = walletBalanceStatus === 'ready' && walletShoppingBalance > 0"));
  assert.ok(client.includes('Math.min(walletShoppingBalance, total)'));
  assert.ok(client.includes('getAuthoritativeQuote(items, selfCollect).then'));
  assert.ok(client.includes('!walletCheckoutReady'));
  assert.ok(client.includes('body: JSON.stringify({ customer, items, selfCollect, guestId: guestId(), useShoppingCredit'));
  assert.ok(!client.includes('setUseShoppingCredit('));
  assert.ok(!page.includes('type="checkbox" checked={c.useShoppingCredit}'));
  assert.ok(page.includes('Automatically applying Rs.'));
  assert.ok(summary.includes('Total cash wallet automatically applied'));
  assert.ok(actions.includes('disabled={placing||!walletCheckoutReady}'));
  assert.ok(backend.includes('createShoppingWalletOrder(user.uid, orderId'));
  assert.ok(backend.includes('const walletShoppingBalance = (quoteOnly && useShoppingCredit && user)'));
});

const bonus = loadTS('lib/playInstallBonus.ts', {},
  { PLAY_INSTALL_BONUS_ENABLED: 'true', PLAY_BONUS_DEVICE_HMAC_SECRET: 'very-long-secret-string-that-meets-minimum', FIREBASE_SERVICE_ACCOUNT_KEY: '{}' });
test('Hash app-scoped Android ID on server, never store IMEI or raw Android ID', () => {
  const one = bonus.deviceDigest('a1b2c3d4e5f60001');
  assert.match(one, /^[a-f0-9]{64}$/);
  assert.equal(one, bonus.deviceDigest('A1B2C3D4E5F60001'));
  assert.notEqual(one, bonus.deviceDigest('a1b2c3d4e5f60002'));
  assert.ok(!one.includes('a1b2c3'));
  assert.throws(() => bonus.deviceDigest('356789012345678'), /Invalid.*Android/); // IMEI is not acceptable
});
test('Low-friction Play app bonus needs no Google Cloud or Play Integrity credentials', () => {
  assert.equal(bonus.bonusIsEnabled(), true);
  const server = fs.readFileSync('lib/playInstallBonus.ts', 'utf8');
  const route = fs.readFileSync('app/api/reseller/play-install-bonus/route.ts', 'utf8');
  const android = fs.readFileSync('play-store/android-twa/app/src/main/java/com/primehubmall/app/PlayBonusManager.java', 'utf8');
  const gradle = fs.readFileSync('play-store/android-twa/app/build.gradle', 'utf8');
  assert.ok(!server.includes('playintegrity.googleapis.com'));
  assert.ok(!server.includes('FIREBASE_SERVICE_ACCOUNT_KEY'));
  assert.ok(route.includes("body?.action !== 'claim'"));
  assert.ok(android.includes('com.android.vending'));
  assert.ok(!android.includes('IntegrityManagerFactory'));
  assert.ok(!gradle.includes('com.google.android.play:integrity'));
  assert.ok(server.includes("db.collection('reseller_play_install_claims').doc(uid)"));
  assert.ok(server.includes("db.collection('reseller_play_install_devices').doc(hash)"));
  assert.ok(server.includes('db.runTransaction(async tx =>'));
  assert.ok(server.includes("type: 'play_install_bonus'"));
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
test('No IMEI permissions or Integrity prompts; native app automatic welcome gift', () => {
  const manifest = fs.readFileSync('play-store/android-twa/app/src/main/AndroidManifest.xml', 'utf8');
  const bridge = fs.readFileSync('play-store/android-twa/app/src/main/java/com/primehubmall/app/PushManager.java', 'utf8');
  const manager = fs.readFileSync('play-store/android-twa/app/src/main/java/com/primehubmall/app/PlayBonusManager.java', 'utf8');
  assert.ok(!manifest.includes('READ_PHONE_STATE'));
  assert.ok(!manifest.includes('READ_PRIVILEGED_PHONE_STATE'));
  assert.ok(manager.includes('Settings.Secure.ANDROID_ID'));
  assert.ok(manager.includes('com.android.vending'));
  assert.ok(!manager.includes('IntegrityManagerFactory'));
  assert.ok(bridge.includes('"playBonus".equals(action)'));
  assert.ok(!manager.includes('TelephonyManager'));
  assert.ok(!manager.includes('getImei()'));
});
