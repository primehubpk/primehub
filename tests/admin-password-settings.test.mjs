import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

function loadAdminSession() {
  let document = null;
  const store = {
    collection: name => {
      assert.equal(name, 'admin_login_credentials');
      return { doc: id => {
        assert.equal(id, 'primary');
        return {
          get: async () => ({ exists: document !== null, data: () => document }),
          set: async v => { document = v; },
        };
      }};
    },
  };
  const source = fs.readFileSync('lib/walletAdminSession.ts', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  const module = { exports: {} };
  const sandbox = {
    module, exports: module.exports, Buffer,
    process: { env: {
      FIREBASE_SERVICE_ACCOUNT_KEY: JSON.stringify({ private_key: '-----BEGIN PRIVATE KEY-----\\nexisting-firebase-service-account-test\\n-----END PRIVATE KEY-----' }),
      NODE_ENV: 'production',
    }},
    require: name => {
      if (name === 'server-only') return {};
      if (name === 'node:crypto') return crypto;
      if (name === '@/lib/firebaseAdmin') return { getAdminDb: () => store };
      throw new Error('Unexpected import: ' + name);
    },
  };
  vm.runInNewContext(js, sandbox, { filename: 'lib/walletAdminSession.ts' });
  return { session: module.exports, sandbox, credential: () => document };
}

test('Original Admin Panel password works without Vercel admin password settings', async () => {
  const { session } = loadAdminSession();
  assert.equal(await session.adminPasswordMatches('junaid00'), true);
  assert.equal(await session.adminPasswordMatches('not-correct'), false);
  await session.setAdminPassword('new-independent-very-strong-password');
  assert.equal(await session.adminPasswordMatches('junaid00'), false);
  assert.equal(await session.adminPasswordMatches('new-independent-very-strong-password'), true);
});

test('Password change stores only salted scrypt hash, not cleartext', async () => {
  const { session, credential } = loadAdminSession();
  await session.setAdminPassword('a-long-unique-password-2026');
  const item = credential();
  assert.equal(item.algorithm, 'scrypt-v1');
  assert.ok(/^[0-9a-f]{32}$/.test(item.salt));
  assert.ok(/^[0-9a-f]{128}$/.test(item.hash));
  assert.ok(!JSON.stringify(item).includes('a-long-unique-password-2026'));
  assert.throws(() => session.adminPasswordRecord('short'), /12/);
});

test('Signed cookie uses independent secret and rejects forgeries, expiry', () => {
  const { session, sandbox } = loadAdminSession();
  const now = 1791962000;
  const token = session.issueWalletAdminSession(now);
  const req = value => ({ headers: { get: name => name === 'cookie' ?
    'primehub_wallet_admin_session=' + value : '' } });
  assert.equal(session.authorizedWalletAdmin(req(token), now + 100), true);
  assert.equal(session.authorizedWalletAdmin(req(token), now + 14400), false);
  assert.equal(session.authorizedWalletAdmin(req(token + 'x'), now + 100), false);
  assert.equal(session.authorizedWalletAdmin(req('guessable'), now + 100), false);
  sandbox.process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({ private_key: '-----BEGIN PRIVATE KEY-----\\nrotated-firebase-test-key\\n-----END PRIVATE KEY-----' });
  assert.equal(session.authorizedWalletAdmin(req(token), now + 100), false);
});

test('Admin Settings form updates admin login, never unrelated Firebase Auth', () => {
  const settings = fs.readFileSync('components/admin/settings/useSiteSettings.ts', 'utf8');
  const route = fs.readFileSync('app/api/admin/change-password/route.ts', 'utf8');
  const login = fs.readFileSync('app/api/admin/login/route.ts', 'utf8');
  const session = fs.readFileSync('app/api/admin/session/route.ts', 'utf8');
  assert.ok(settings.includes("fetch('/api/admin/change-password'"));
  assert.ok(!settings.includes('updatePassword(user, newPassword)'));
  assert.ok(!settings.includes('reauthenticateWithCredential'));
  assert.ok(route.includes('authorizedWalletAdmin(request)'));
  assert.ok(route.includes("request.headers.get('origin')"));
  assert.ok(route.includes('setAdminPassword(newPassword)'));
  assert.ok(route.includes("maxAge: 0"));
  assert.ok(login.includes('await adminPasswordMatches(password)'));
  assert.ok(session.includes('authorizedWalletAdmin(request)'));
  const source = fs.readFileSync('lib/walletAdminSession.ts', 'utf8');
  assert.ok(!source.includes('process.env.ADMIN_PASSWORD'));
  assert.ok(!source.includes('process.env.ADMIN_SESSION_SECRET'));
  assert.ok(!source.includes("const ADMIN_PASSWORD = "));
  assert.ok(!source.includes("= 'junaid00'"));
});
