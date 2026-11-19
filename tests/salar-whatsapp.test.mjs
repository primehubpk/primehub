import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { verifySignature, extractMessages, openQueue, enqueue, processNext, createWebhookServer, readConfig } from '../tools/salar-whatsapp/runner.mjs';

const now = Date.now();
const config = { phoneId: '12345', appSecret: 'test-app-secret', verifyToken: 'test-verify', bridgeToken: 'x'.repeat(32), bridge: 'http://127.0.0.1:3000/api/salar/whatsapp', graph: 'v25.0', accessToken: 'test-only', origin: 'https://store.example', productLimit: 3, sendEnabled: false, currency: 'PKR' };
const message = (id = 'wamid.test01', sender = '923000000001') => ({ id, sender, type: 'text', timestamp: Math.floor(now / 1000), message: 'Hello' });
const event = () => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: '12345' }, messages: [{ id: 'wamid.test01', from: '923000000001', timestamp: String(Math.floor(now / 1000)), type: 'text', text: { body: 'Hello' } }] } }] }] });

test('webhook signature uses exact raw bytes; tampering fails', () => {
  const body = Buffer.from('{"message":"hello"}');
  const sig = 'sha256=' + createHmac('sha256', config.appSecret).update(body).digest('hex');
  assert.equal(verifySignature(body, sig, config.appSecret), true);
  assert.equal(verifySignature(Buffer.from('{"message":"changed"}'), sig, config.appSecret), false);
  assert.equal(verifySignature(body, '', config.appSecret), false);
});

test('status notifications and other business numbers never become customer messages', () => {
  assert.equal(extractMessages(event(), 'other').length, 0);
  const e = event(); delete e.entry[0].changes[0].value.messages;
  e.entry[0].changes[0].value.statuses = [{ status: 'delivered' }];
  assert.equal(extractMessages(e, config.phoneId).length, 0);
  assert.equal(extractMessages(event(), config.phoneId).length, 1);
});

test('duplicate incoming messages are persisted once and unsupported media waits for human', () => {
  const db = openQueue(':memory:');
  enqueue(db, [message(), message(), { ...message('wamid.audio01'), type: 'audio' }]);
  assert.equal(db.prepare('select count(*) as n from inbox').get().n, 2);
  assert.equal(db.prepare('select state from inbox where id=?').get('wamid.audio01').state, 'review');
  db.close();
});

test('default mode prepares a draft without sending to Meta', async () => {
  const db = openQueue(':memory:'); enqueue(db, [message()]); let calls = 0;
  await processNext(db, config, async url => { calls++; assert.equal(url, config.bridge); return Response.json({ reply: 'Hello', products: [] }); }, now);
  assert.equal(calls, 1);
  assert.equal(db.prepare('select state from inbox').get().state, 'review'); db.close();
});

test('expired customer service window never calls AI or sends', async () => {
  const db = openQueue(':memory:'); enqueue(db, [{ ...message(), timestamp: Math.floor(now / 1000) - 86401 }]);
  await processNext(db, config, async () => assert.fail('No external call expected'), now);
  assert.equal(db.prepare('select state from inbox').get().state, 'review'); db.close();
});

test('ambiguous outbound timeout is not retried and holds later messages from that customer', async () => {
  const db = openQueue(':memory:'); enqueue(db, [message(), message('wamid.test02')]); let sends = 0;
  const fetcher = async url => { if (url === config.bridge) return Response.json({ reply: 'Hello', products: [] }); sends++; throw new Error('Timeout after request might have been accepted'); };
  await processNext(db, { ...config, sendEnabled: true }, fetcher, now);
  await processNext(db, { ...config, sendEnabled: true }, fetcher, now);
  assert.equal(sends, 1);
  assert.equal(db.prepare('select state from inbox where id=?').get('wamid.test01').state, 'review'); db.close();
});

test('quoted product IDs are scoped to the same sender', async () => {
  const db = openQueue(':memory:');
  db.prepare('insert into outgoing values(?,?,?)').run('outgoing-id', '923000000002', 'private-product');
  enqueue(db, [{ ...message(), replyTo: 'outgoing-id' }]);
  await processNext(db, config, async (_url, init) => {
    assert.deepEqual(JSON.parse(init.body).productIds, []);
    return Response.json({ reply: 'Please clarify' });
  }, now); db.close();
});

test('successful API acceptance records native photo reply reference', async () => {
  const db = openQueue(':memory:'); enqueue(db, [message()]); let send = 0;
  await processNext(db, { ...config, sendEnabled: true }, async (url, init) => {
    if (url === config.bridge) return Response.json({ reply: 'Selected design', products: [{ id: 'p1', title: 'Design', price: 123, imageUrl: 'https://images.example/p1.jpg' }] });
    send++; const body = JSON.parse(init.body); assert.equal(body.to, message().sender);
    return Response.json({ messages: [{ id: `outgoing-${send}` }] });
  }, now);
  assert.equal(db.prepare('select state from inbox').get().state, 'sent');
  assert.equal(db.prepare('select product_id from outgoing where message_id=?').get('outgoing-2').product_id, 'p1'); db.close();
});

test('real local HTTP receiver verifies signature before accepting, and deduplicates retries', async () => {
  const db = openQueue(':memory:'), server = createWebhookServer(db, config);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${server.address().port}/webhook`, body = JSON.stringify(event());
    const sig = 'sha256=' + createHmac('sha256', config.appSecret).update(body).digest('hex');
    assert.equal((await fetch(url, { method: 'POST', body })).status, 401);
    for (let i = 0; i < 2; i++) assert.equal((await fetch(url, { method: 'POST', body, headers: { 'x-hub-signature-256': sig } })).status, 200);
    assert.equal(db.prepare('select count(*) as n from inbox').get().n, 1);
  } finally { server.close(); await once(server, 'close'); db.close(); }
});

test('missing configuration fails closed; arbitrary bridge hosts are rejected', () => {
  assert.throws(() => readConfig({}), /Missing configuration/);
  const env = { WHATSAPP_APP_SECRET: 'test', WHATSAPP_VERIFY_TOKEN: 'test', WHATSAPP_ACCESS_TOKEN: 'test', WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_GRAPH_VERSION: 'v25.0', SALAR_WHATSAPP_BRIDGE_TOKEN: 'x'.repeat(32), SALAR_WHATSAPP_DATA_DIR: '/tmp/test-data', SALAR_STOREFRONT_ORIGIN: 'https://store.example' };
  assert.equal(readConfig(env).sendEnabled, false);
  assert.throws(() => readConfig({ ...env, SALAR_WHATSAPP_BRIDGE_URL: 'https://external.example' }), /private local/);
});
