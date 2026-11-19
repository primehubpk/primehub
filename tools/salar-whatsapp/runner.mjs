import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function equalSecret(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}
export function verifySignature(body, signature, secret) {
  return Boolean(secret) && equalSecret(signature, `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`);
}
export function readConfig(env = process.env) {
  const required = ['WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_GRAPH_VERSION', 'SALAR_WHATSAPP_BRIDGE_TOKEN', 'SALAR_WHATSAPP_DATA_DIR', 'SALAR_STOREFRONT_ORIGIN'];
  for (const field of required) if (!env[field]?.trim()) throw new Error(`Missing configuration: ${field}`);
  if (env.SALAR_WHATSAPP_BRIDGE_TOKEN.length < 32) throw new Error('Bridge token must have at least 32 characters');
  if (!/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_VERSION) || !/^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID)) throw new Error('Invalid Meta configuration');
  const bridge = new URL(env.SALAR_WHATSAPP_BRIDGE_URL || 'http://127.0.0.1:3000/api/salar/whatsapp');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(bridge.hostname) || bridge.protocol !== 'http:' || bridge.username || bridge.password) throw new Error('Bridge must use the private local HTTP server');
  const origin = new URL(env.SALAR_STOREFRONT_ORIGIN);
  if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error('Storefront requires a public HTTPS origin');
  const port = Number(env.SALAR_WHATSAPP_PORT || 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port');
  return { appSecret: env.WHATSAPP_APP_SECRET, verifyToken: env.WHATSAPP_VERIFY_TOKEN, accessToken: env.WHATSAPP_ACCESS_TOKEN,
    phoneId: env.WHATSAPP_PHONE_NUMBER_ID, graph: env.WHATSAPP_GRAPH_VERSION, bridgeToken: env.SALAR_WHATSAPP_BRIDGE_TOKEN,
    bridge: bridge.href, origin: origin.origin, dataDir: resolve(env.SALAR_WHATSAPP_DATA_DIR), port,
    sendEnabled: env.SALAR_WHATSAPP_SEND_ENABLED === 'true', productLimit: Math.max(1, Math.min(8, Number(env.SALAR_WHATSAPP_PRODUCT_LIMIT) || 3)),
    currency: env.SALAR_CURRENCY_CODE || '' };
}
export function extractMessages(payload, phoneId) {
  if (payload?.object !== 'whatsapp_business_account') return [];
  const messages = [];
  for (const entry of payload.entry || []) for (const change of entry.changes || []) {
    const value = change.value;
    if (change.field !== 'messages' || String(value?.metadata?.phone_number_id) !== phoneId) continue;
    for (const m of value.messages || []) {
      if (!/^\d{6,15}$/.test(m.from || '') || !/^[A-Za-z0-9_.=:+/-]{8,250}$/.test(m.id || '') || !Number.isFinite(Number(m.timestamp))) continue;
      const contact = (value.contacts || []).find(c => c.wa_id === m.from);
      messages.push({ id: m.id, sender: m.from, timestamp: Number(m.timestamp), type: m.type,
        name: String(contact?.profile?.name || '').slice(0, 120), message: String(m.text?.body || m.image?.caption || '').slice(0, 8000),
        imageId: m.type === 'image' ? m.image?.id : undefined, replyTo: m.context?.id });
    }
  }
  return messages;
}
export function openQueue(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, sender TEXT NOT NULL, received INTEGER NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, draft TEXT, reason TEXT);
    CREATE TABLE IF NOT EXISTS outgoing (message_id TEXT PRIMARY KEY, sender TEXT NOT NULL, product_id TEXT);
    UPDATE inbox SET state='pending' WHERE state='processing';
    UPDATE inbox SET state='review', reason='Uncertain send after restart; reconcile before retry' WHERE state='sending';`);
  return db;
}
export function enqueue(db, messages) {
  const insert = db.prepare('INSERT OR IGNORE INTO inbox(id,sender,received,payload,state,reason) VALUES(?,?,?,?,?,?)');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const m of messages) {
      const supported = m.type === 'text' || (m.type === 'image' && /^\d+$/.test(m.imageId || ''));
      insert.run(m.id, m.sender, m.timestamp, JSON.stringify(m), supported ? 'pending' : 'review', supported ? null : 'Unsupported message type: human response needed');
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
async function readLimited(stream, max) {
  const chunks = []; let size = 0;
  for await (const chunk of stream) { size += chunk.length; if (size > max) throw new Error('Size limit'); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
async function getImage(config, mediaId, fetcher) {
  const response = await fetcher(`https://graph.facebook.com/${config.graph}/${mediaId}`, { headers: { Authorization: `Bearer ${config.accessToken}` }, signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!response.ok) throw new Error('Media metadata unavailable');
  const data = await response.json(), url = new URL(data.url);
  // Meta download hosts only; never attach a token to a customer-supplied URL.
  if (url.protocol !== 'https:' || !(url.hostname === 'lookaside.fbsbx.com' || url.hostname.endsWith('.fbcdn.net')) || url.username || url.password) throw new Error('Unexpected media host');
  const media = await fetcher(url, { headers: { Authorization: `Bearer ${config.accessToken}` }, signal: AbortSignal.timeout(10000), redirect: 'error' });
  const mimeType = (media.headers.get('content-type') || '').split(';')[0];
  if (!media.ok || !/^image\/(jpeg|png|webp)$/.test(mimeType)) throw new Error('Unsupported image');
  const bytes = await readLimited(media.body, 3 * 1024 * 1024);
  return { mimeType, base64: bytes.toString('base64') };
}
export function outgoingParts(draft, config) {
  const parts = [];
  // Natural wording comes from Salar; transport only chunks text and attaches
  // verified product fields. No fixed selling script, offer or price.
  const text = String(draft.reply || '');
  for (let i = 0; i < text.length; i += 3500) parts.push({ type: 'text', text: { body: text.slice(i, i + 3500) } });
  for (const p of (draft.products || []).slice(0, config.productLimit)) {
    const link = new URL(`/product/${encodeURIComponent(p.id)}`, config.origin).href;
    const caption = [p.title, p.price == null ? '' : `${config.currency} ${p.price}`.trim(), link].filter(Boolean).join('\n').slice(0, 1000);
    let image;
    try { image = new URL(p.imageUrl); } catch { /* Text card when no image is available. */ }
    parts.push(image?.protocol === 'https:' ? { type: 'image', image: { link: image.href, caption }, productId: p.id }
      : { type: 'text', text: { body: caption }, productId: p.id });
  }
  return parts;
}
export async function processNext(db, config, fetcher = fetch, now = Date.now()) {
  const row = db.prepare("SELECT i.* FROM inbox i WHERE i.state='pending' AND i.next_at<=? AND NOT EXISTS (SELECT 1 FROM inbox earlier WHERE earlier.sender=i.sender AND earlier.rowid<i.rowid AND earlier.state NOT IN ('sent','resolved')) ORDER BY i.received,i.rowid LIMIT 1").get(now);
  if (!row) return false;
  const mark = (state, reason = null) => db.prepare('UPDATE inbox SET state=?,reason=? WHERE id=?').run(state, reason, row.id);
  if (now / 1000 - row.received >= 24 * 60 * 60 || row.received > now / 1000 + 300) { mark('review', 'Outside customer service window'); return true; }
  if (!db.prepare("UPDATE inbox SET state='processing' WHERE id=? AND state='pending'").run(row.id).changes) return false;
  const m = JSON.parse(row.payload);
  let draft;
  try {
    const quoted = m.replyTo ? db.prepare('SELECT product_id FROM outgoing WHERE message_id=? AND sender=?').get(m.replyTo, m.sender) : null;
    const image = m.imageId ? await getImage(config, m.imageId, fetcher) : undefined;
    const response = await fetcher(config.bridge, { method: 'POST', headers: { Authorization: `Bearer ${config.bridgeToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...m, messageId: m.id, image, productIds: quoted?.product_id ? [quoted.product_id] : [], productLimit: config.productLimit }), signal: AbortSignal.timeout(55000), redirect: 'error' });
    if (!response.ok) throw new Error('Reply preparation failed');
    draft = await response.json();
    if (draft.paused) { mark('review', 'Salar paused or contact blocked'); return true; }
    db.prepare('UPDATE inbox SET draft=? WHERE id=?').run(JSON.stringify(draft), row.id);
  } catch {
    const attempts = row.attempts + 1;
    db.prepare('UPDATE inbox SET state=?,attempts=?,next_at=?,reason=? WHERE id=?').run(attempts >= 3 ? 'review' : 'pending', attempts, now + 15000 * attempts, 'Preparation unavailable', row.id);
    return true;
  }
  if (!config.sendEnabled) { mark('review', 'Draft only: sending disabled'); return true; }
  if (Date.now() / 1000 - row.received >= 24 * 60 * 60) { mark('review', 'Service window expired during preparation'); return true; }
  const parts = outgoingParts(draft, config);
  if (!parts.length || parts.length > 12) { mark('review', 'Empty or excessive response'); return true; }
  // Once any outbound request starts, never blindly retry an ambiguous outcome.
  // Cloud API message creation has no caller-supplied idempotency key here.
  mark('sending');
  try {
    for (const part of parts) {
      const { productId, ...content } = part;
      const response = await fetcher(`https://graph.facebook.com/${config.graph}/${config.phoneId}/messages`, {
        method: 'POST', headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: m.sender, ...content }), signal: AbortSignal.timeout(15000), redirect: 'error' });
      if (!response.ok) throw new Error('Delivery unresolved');
      const data = await response.json();
      if (!data.messages?.[0]?.id) throw new Error('Missing delivery receipt');
      db.prepare('INSERT OR IGNORE INTO outgoing(message_id,sender,product_id) VALUES(?,?,?)').run(data.messages[0].id, m.sender, productId || null);
    }
    mark('sent'); // Accepted by API, not proof of handset delivery/read.
  } catch { mark('review', 'Send outcome uncertain: inspect receipts before retry'); }
  return true;
}
export function createWebhookServer(db, config) {
  return createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end(body); };
    if (url.pathname !== '/webhook') return reply(404, 'Not found');
    if (req.method === 'GET') {
      return url.searchParams.get('hub.mode') === 'subscribe' && equalSecret(url.searchParams.get('hub.verify_token'), config.verifyToken)
        ? reply(200, url.searchParams.get('hub.challenge') || '') : reply(403, 'Forbidden');
    }
    if (req.method !== 'POST') return reply(405, 'Method not allowed');
    try {
      const raw = await readLimited(req, 1024 * 1024);
      if (!verifySignature(raw, req.headers['x-hub-signature-256'], config.appSecret)) return reply(401, 'Invalid signature');
      const payload = JSON.parse(raw.toString());
      if (payload.object !== 'whatsapp_business_account') return reply(400, 'Invalid event');
      enqueue(db, extractMessages(payload, config.phoneId));
      reply(200, 'Accepted'); // Durable write happened before acknowledgement.
    } catch { reply(400, 'Invalid request'); }
  });
}
export async function main() {
  const config = readConfig();
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  const lockPath = resolve(config.dataDir, 'runner.lock');
  const lock = openSync(lockPath, 'wx', 0o600);
  const db = openQueue(resolve(config.dataDir, 'queue.sqlite'));
  const server = createWebhookServer(db, config);
  server.listen(config.port, '127.0.0.1', () => console.log(`Salar WhatsApp local adapter ready on port ${config.port}; sending ${config.sendEnabled ? 'enabled' : 'disabled (draft only)'}`));
  let closing = false;
  const stop = () => { closing = true; server.close(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  while (!closing) { await processNext(db, config); if (!closing) await new Promise(resolve => setTimeout(resolve, 1000)); }
  db.close();
  closeSync(lock); unlinkSync(lockPath);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error('Salar adapter could not start. Check required configuration and local file permissions.'); process.exitCode = 1; });
