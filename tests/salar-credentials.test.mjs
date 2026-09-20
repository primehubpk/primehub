import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sealCredentials, openCredentials } from '../lib/salar/credentialCrypto.ts';
import { providerTargets } from '../lib/salar/providerConfig.ts';

process.env.SALAR_KEYS_ENCRYPTION_KEY = 'test-only-root-with-at-least-thirty-two-characters';
test('saved credentials encrypt uniquely and round-trip without plaintext', () => {
  const value = { keys: ['test-secret-token'], accountId: 'b'.repeat(32) };
  const first = sealCredentials('cloudflare', value);
  assert.ok(!first.includes(value.keys[0]));
  assert.notEqual(first, sealCredentials('cloudflare', value));
  assert.deepEqual(openCredentials('cloudflare', first), value);
});
test('credential envelopes reject tampering, wrong provider and wrong root', () => {
  const envelope = sealCredentials('groq', { keys: ['test-key'] });
  assert.throws(() => openCredentials('gemini', envelope));
  const parts = envelope.split('.'); const data = Buffer.from(parts[3], 'base64url'); data[0] ^= 1; parts[3] = data.toString('base64url');
  assert.throws(() => openCredentials('groq', parts.join('.')));
  const root = process.env.SALAR_KEYS_ENCRYPTION_KEY;
  process.env.SALAR_KEYS_ENCRYPTION_KEY = 'different-root-with-at-least-thirty-two-characters';
  assert.throws(() => openCredentials('groq', envelope));
  process.env.SALAR_KEYS_ENCRYPTION_KEY = root;
});
test('saved keys override environment in fallback order and account matches target', () => {
  process.env.CLOUDFLARE_AI_API_TOKEN = 'environment-key';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'a'.repeat(32);
  const targets = providerTargets(false, undefined, { cloudflare: { keys: ['saved-1', 'saved-2'], accountId: 'b'.repeat(32) } });
  assert.deepEqual(targets.filter(x => x.provider === 'cloudflare').map(x => x.apiKey), ['saved-1', 'saved-2']);
  assert.equal(targets[0].accountId, 'b'.repeat(32));
  assert.equal(providerTargets(false)[0].apiKey, 'environment-key');
});
test('disabled provider cannot fall through to environment keys', () => {
  assert.equal(providerTargets(false, undefined, { cloudflare: { keys: [], disabled: true } }).some(x => x.provider === 'cloudflare'), false);
});
