import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, dependencies, globals = {}) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => {
    if (name in dependencies) return dependencies[name];
    if (name === 'node:crypto') return require(name);
    throw new Error(`Unexpected dependency ${name}`);
  }, console: { info() {}, warn() {}, error() {} }, URL, URLSearchParams, Request, Response, FormData, File, Buffer, AbortSignal, crypto: globalThis.crypto, process, ...globals });
  return exports;
}
const search = load('lib/smartSearch.ts', {});
const config = load('lib/salar/providerConfig.ts', {});
const product = (id, category, extra = {}) => ({ id, title: `${category} design ${id}`, category, images: [`https://images.example/${id}.jpg`], ...extra });
function setup() {
  const state = {
    enabled: true, instructions: 'OWNER RULE: brief conversational replies. Show every requested matching design. Do not mix categories.',
    orderInstructions: 'OWNER ORDER RULE: ask before confirming an order.',
    providerSelection: { preferredProvider: 'custom', models: { custom: 'test' } },
    catalogue: { categories: [{ id: 'glass', title: 'Glass Bangles' }, { id: 'plastic', title: 'Plastic Bangles' }],
      products: [...Array.from({ length: 47 }, (_, i) => product(`g${i}`, 'Glass Bangles')),
        ...Array.from({ length: 25 }, (_, i) => product(`j${i}`, 'Plastic Bangles', { title: `Jelly Bangles ${i}` })), product('other', 'Plastic Bangles')],
      pages: [], storefront: {}, updatedAt: '' },
  };
  let calls = 0;
  let handler = () => ({ reply: 'Ji, batayein.', display: 'none' });
  const prompts = [];
  const engine = load('lib/salar/modelDrivenEngine.ts', {
    'server-only': {}, '@/lib/salar/server': { getSalarState: async () => state },
    '@/lib/salar/credentialStore': { getProviderCredentials: async () => ({ custom: { keys: ['test'], baseUrl: 'https://model.example/v1' } }) },
    '@/lib/salar/providerConfig': config, '@/lib/smartSearch': search,
  }, { fetch: async (_url, init) => {
    calls++;
    const body = JSON.parse(init.body); prompts.push(body.messages);
    const value = await handler(calls, init.signal);
    return value instanceof Response ? value : Response.json({ choices: [{ message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }] });
  } });
  return { state, engine, prompts, setHandler: fn => { handler = fn; }, calls: () => calls };
}

test('full saved guidance reaches provider; brief admin-guided response is preserved', async () => {
  const t = setup();
  t.state.instructions += '\n' + 'Owner instruction. '.repeat(1000) + 'FINAL ADMIN RULE';
  const result = await t.engine.answerWithModelDrivenSalar({ message: 'Hi' });
  assert.equal(result.reply, 'Ji, batayein.');
  assert.equal(result.products.length, 0);
  assert.ok(t.prompts[0][0].content.includes(t.state.instructions));
  assert.ok(t.prompts[0][0].content.includes(t.state.orderInstructions));
  assert.equal(t.calls(), 1);
});

test('admin-guided clarification is not replaced by hardcoded product-show logic', async () => {
  const t = setup();
  t.setHandler(() => ({ reply: 'Konsa size chahiye?', display: 'none' }));
  const result = await t.engine.answerWithModelDrivenSalar({ message: 'Show glass bangles' });
  assert.equal(result.reply, 'Konsa size chahiye?');
  assert.equal(result.products.length, 0);
});

test('category discovery returns every matching product, ignores stale focus and unrelated sample IDs', async () => {
  const t = setup();
  t.setHandler(() => ({ reply: 'Ye designs dekhein.', display: 'product_images', searchQuery: 'Glass Bangles', productIds: ['other'], showAllMatches: false }));
  const result = await t.engine.answerWithModelDrivenSalar({ message: 'Glass bangles', exactProductReferences: [{ id: 'other' }] });
  assert.equal(result.products.length, 47);
  assert.ok(result.products.every(p => p.category === 'Glass Bangles'));
  assert.equal(result.showAllMatches, true);
  assert.equal(result.products[0].id, 'g0');
});

test('specific design search does not widen to the entire bangle category', async () => {
  const t = setup();
  t.setHandler(() => ({ reply: 'Ye jelly designs hain.', display: 'product_images', searchQuery: 'jelly bangles', categoryIds: ['plastic'] }));
  const result = await t.engine.answerWithModelDrivenSalar({ message: 'jelly' });
  assert.equal(result.products.length, 25);
  assert.ok(result.products.every(p => p.title.startsWith('Jelly')));
});

test('category membership does not discard requested size, stock or design constraints', async () => {
  const t = setup();
  t.state.catalogue.products = [
    product('yes', 'Glass Bangles', { title: 'Pearl Glass Bangles', variantMatrix: [{ size: '2.8', stock: 2 }] }),
    product('wrong-size', 'Glass Bangles', { title: 'Pearl Glass Bangles', variantMatrix: [{ size: '2.6', stock: 2 }] }),
    product('no-stock', 'Glass Bangles', { title: 'Pearl Glass Bangles', variantMatrix: [{ size: '2.8', stock: 0 }] }),
    product('wrong-design', 'Glass Bangles', { title: 'Plain Glass Bangles', variantMatrix: [{ size: '2.8', stock: 2 }] }),
  ];
  t.setHandler(() => ({ reply: 'Matching design.', display: 'products', searchQuery: 'glass bangles pearl 2.8' }));
  const result = await t.engine.answerWithModelDrivenSalar({ message: 'pearl 2.8' });
  assert.deepEqual(Array.from(result.products, p => p.id), ['yes']);
});

test('unknown category IDs cannot render the whole catalogue', async () => {
  const t = setup();
  t.setHandler(n => n === 1 ? { reply: 'Please clarify.', display: 'products', categoryIds: ['unknown'] } : { reply: 'Which category?', display: 'none' });
  assert.equal((await t.engine.answerWithModelDrivenSalar({ message: 'unknown' })).products.length, 0);
});

test('exact product selection remains exact without a search', async () => {
  const t = setup();
  t.setHandler(() => ({ reply: 'Selected product.', display: 'products', productIds: ['g3'] }));
  assert.deepEqual(Array.from((await t.engine.answerWithModelDrivenSalar({ message: 'ye wala' })).products, p => p.id), ['g3']);
});

test('transient failure retries configured provider without asking customer to resend', async () => {
  const t = setup();
  t.setHandler(n => n === 1 ? new Response('', { status: 503 }) : { reply: 'Ji.', display: 'none' });
  assert.equal((await t.engine.answerWithModelDrivenSalar({ message: 'Hi' })).reply, 'Ji.');
  assert.equal(t.calls(), 2);
});

test('malformed structured reply can recover on the same sole configured provider', async () => {
  const t = setup();
  t.setHandler(n => n === 1 ? 'invalid JSON' : { reply: 'Ji.', display: 'none' });
  assert.equal((await t.engine.answerWithModelDrivenSalar({ message: 'Hi' })).reply, 'Ji.');
  assert.equal(t.calls(), 2);
});

test('a previous failure cooldown does not make subsequent messages fail without a probe', async () => {
  const t = setup();
  t.setHandler(() => new Response('', { status: 503 }));
  await assert.rejects(t.engine.answerWithModelDrivenSalar({ message: 'Hi' }));
  const before = t.calls();
  t.setHandler(() => ({ reply: 'Recovered.', display: 'none' }));
  assert.equal((await t.engine.answerWithModelDrivenSalar({ message: 'Hi' })).reply, 'Recovered.');
  assert.equal(t.calls(), before + 1);
});

test('retrying a saved turn stores one customer message and one reply; completed replay does not call model', async () => {
  const rows = new Map();
  const store = load('lib/salar/chatStore.ts', { 'server-only': {}, '@/lib/dualWriteServer': {
    getSupabasePrimaryPayload: async (_name, id) => rows.get(id) || null,
    mapDocumentToSupabase: (_name, id, payload) => ({ id, payload }),
    supabasePrimaryUpsert: async ({ row }) => { rows.set(row.id, JSON.parse(JSON.stringify(row.payload))); },
  } });
  let calls = 0;
  const route = load('app/api/salar/chat/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/salar/modelDrivenEngine': { isSalarProviderFailure: () => true, answerWithModelDrivenSalar: async () => {
      calls++;
      if (calls === 1) throw new Error('No working Salar AI provider');
      return { reply: 'Recovered reply', products: [], displayMode: 'none' };
    } },
    '@/lib/salar/server': {}, '@/lib/salar/chatStore': store, '@/lib/salar/uiSettings': {},
    '@/lib/salar/blockStore': { isSalarIdentityBlocked: async () => false }, '@/lib/r2': {},
  });
  const send = () => route.POST(new Request('https://store.example/api/salar/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: 'test-chat-12345', messageId: 'test-message-12345', message: 'Hi' }) }));
  const failure = await send();
  assert.equal(failure.status, 503); assert.equal((await failure.json()).retryable, true);
  const success = await send(); assert.equal(success.status, 200);
  const body = await success.json();
  assert.equal(body.chat.messages.filter(m => m.actor === 'customer').length, 1);
  assert.equal(body.chat.messages.filter(m => m.actor === 'salar').length, 1);
  assert.equal((await send()).status, 200); assert.equal(calls, 2);
});

test('legacy Salar snapshot gains complete variants/descriptions once per cached read without altering admin guidance', async () => {
  let reads = 0;
  const payload = { enabled: true, instructions: 'Current owner instructions.', orderInstructions: 'Current payment flow.', catalogue: { products: [{ id: 'p', title: 'Incomplete card' }], categories: [], pages: [], storefront: {}, updatedAt: '' } };
  const stateServer = load('lib/salar/server.ts', {
    'server-only': {}, '@/lib/salar/credentialStore': {}, '@/lib/salar/providerConfig': config,
    'next/cache': { unstable_cache: fn => { let cached; return () => cached ??= fn(); }, revalidateTag() {} },
    '@/lib/publicCatalogServer': { getFreshStorefrontSettingsSnapshot: async () => ({ freeShippingCount: 5 }) },
    '@/lib/dualReadServer': { getDualFeedCatalog: async () => {
      reads++;
      return { source: 'supabase', categories: [{ id: 'glass', title: 'Glass Bangles' }], products: [
        product('older', 'Glass Bangles', { createdAt: '2026-10-01', description: 'Full product detail', variantMatrix: [{ size: '2.8', stock: 30, imageUrl: 'https://images.example/variant.jpg' }] }),
        product('newer', 'Glass Bangles', { createdAt: '2026-10-12', description: 'New arrival' }),
      ] };
    } },
    '@/lib/dualWriteServer': { getSupabasePrimaryPayload: async () => structuredClone(payload) },
  }, { structuredClone });
  const state = await stateServer.getSalarState();
  assert.equal(state.instructions, payload.instructions);
  assert.equal(state.orderInstructions, payload.orderInstructions);
  assert.equal(state.catalogue.detailVersion, 2);
  assert.equal(state.catalogue.products[0].id, 'newer');
  assert.equal(state.catalogue.products[1].variantMatrix[0].size, '2.8');
  assert.equal(state.catalogue.products[1].description, 'Full product detail');
  assert.equal(state.catalogue.storefront.freeShippingCount, 5);
  assert.ok(state.catalogue.products[1].images.includes('https://images.example/variant.jpg'));
  await stateServer.getSalarState();
  assert.equal(reads, 1);
});

 test('empty retrieval is fed back to the model rather than claiming images were displayed', async () => {
  const t = setup();
  t.setHandler(n => n === 1 ? { reply: 'Here are the images.', display: 'products', searchQuery: 'nonexistent-design-xyz' } : { reply: 'Is design ka naam confirm kar dein?', display: 'none' });
  const result = await t.engine.answerWithModelDrivenSalar({ message: 'nonexistent-design-xyz' });
  assert.equal(result.products.length, 0);
  assert.equal(result.reply, 'Is design ka naam confirm kar dein?');
  assert.match(t.prompts[1][0].content, /no products matched/);
});

test('customer references ignore assistant galleries and preserve latest customer selection', () => {
  const store = load('lib/salar/chatStore.ts', { 'server-only': {}, '@/lib/dualWriteServer': {} });
  const refs = store.recentCustomerProductReferences({ messages: [
    { actor: 'customer', products: [{ id: 'selected', title: 'Selected' }] },
    { actor: 'salar', products: [{ id: 'not-selected', title: 'Gallery' }] },
    { actor: 'admin', products: [{ id: 'suggestion', title: 'Suggestion' }] },
  ] }, 1);
  assert.deepEqual(Array.from(refs, p => p.id), ['selected']);
});

test('all thirty selected prices survive detailed context limits in customer priority order', async () => {
  const t = setup();
  const ids = Array.from({ length: 30 }, (_, i) => `g${29 - i}`);
  t.state.catalogue.products.forEach((p, i) => { p.price = 100 + i; });
  await t.engine.answerWithModelDrivenSalar({ message: 'Prices of these selected designs', exactProductIds: ids });
  const prompt = t.prompts[0][0].content;
  const line = prompt.split('\n').find(s => s.startsWith('EXACT CUSTOMER PRODUCT PRICES'));
  const data = JSON.parse(line.slice(line.indexOf(': ') + 2));
  assert.deepEqual(data.map(p => p.id), ids);
  assert.equal(data[0].price, 129);
  const detailedLine = prompt.split('\n').find(s => s.startsWith('RELEVANT/EXACT LIVE PRODUCTS:'));
  assert.equal(JSON.parse(detailedLine.split(': ').slice(1).join(': '))[0].id, ids[0]);
});

test('long recent customer context is retained rather than silently dropping the turn', async () => {
  const t = setup();
  await t.engine.answerWithModelDrivenSalar({ message: 'Their prices please', history: [
    { role: 'user', content: 'SELECTED-CUSTOMER-REFERENCE ' + 'details '.repeat(500) },
    { role: 'assistant', content: 'Please choose.' },
  ] });
  assert.ok(t.prompts[0].some(m => typeof m.content === 'string' && m.content.includes('SELECTED-CUSTOMER-REFERENCE')));
});

test('delivery settings remain visible behind a large unrelated promotion payload', async () => {
  const t = setup();
  t.state.catalogue.storefront = { bigDeal: { copy: 'banner '.repeat(1000) }, freeShippingCount: 7, freeDelivery: { enabled: true } };
  await t.engine.answerWithModelDrivenSalar({ message: 'Shipping is expensive' });
  const line = t.prompts[0][0].content.split('\n').find(s => s.startsWith('CURRENT DELIVERY AND SHOP POLICIES:'));
  assert.equal(JSON.parse(line.slice(line.indexOf(': ') + 2)).freeShippingCount, 7);
});

test('version two saved snapshots also refresh current products and shop policy', async () => {
  const server = load('lib/salar/server.ts', {
    'server-only': {}, '@/lib/salar/credentialStore': {}, '@/lib/salar/providerConfig': config,
    'next/cache': { unstable_cache: fn => fn, revalidateTag() {} },
    '@/lib/publicCatalogServer': { getFreshStorefrontSettingsSnapshot: async () => ({ freeShippingCount: 7 }) },
    '@/lib/dualReadServer': { getDualFeedCatalog: async () => ({ source: 'supabase', categories: [], products: [product('live', 'Glass', { price: 125 })] }) },
    '@/lib/dualWriteServer': { getSupabasePrimaryPayload: async () => ({ enabled: true, instructions: 'Keep owner rules', catalogue: { detailVersion: 2, products: [{ id: 'stale', price: 10 }], pages: [], storefront: {}, categories: [] } }) },
  });
  const state = await server.getSalarState();
  assert.equal(state.catalogue.products[0].id, 'live');
  assert.equal(state.catalogue.products[0].price, 125);
  assert.equal(state.catalogue.storefront.freeShippingCount, 7);
  assert.equal(state.instructions, 'Keep owner rules');
});

test('admin chat history rejects forged legacy cookie and verifies signed sessions', async () => {
  const wallet = load('lib/walletAdminSession.ts', { 'server-only': {}, '@/lib/firebaseAdmin': {} }, {
    process: { env: { FIREBASE_SERVICE_ACCOUNT_KEY: JSON.stringify({ private_key: '-----BEGIN PRIVATE KEY-----test-only-signing-input' }) } },
  });
  let reads = 0;
  const route = load('app/api/admin/salar/chats/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/adminSession': { verifyPrimeHubAdminRequest: async req => wallet.authorizedWalletAdmin(req) ? { admin: true } : null },
    '@/lib/salar/chatStore': { cleanChatId: () => '', listSalarChats: async () => { reads++; return []; } },
    '@/lib/salar/blockStore': { listBlockedSalarChatIds: async () => new Set() },
  });
  const url = 'https://store.example/api/admin/salar/chats';
  assert.equal((await route.GET(new Request(url, { headers: { cookie: 'primehub_admin_auth=true' } }))).status, 401);
  assert.equal(reads, 0);
  const cookie = `${wallet.WALLET_ADMIN_COOKIE}=${wallet.issueWalletAdminSession()}`;
  assert.equal((await route.GET(new Request(url, { headers: { cookie } }))).status, 200);
  assert.equal(reads, 1);
  assert.equal((await route.GET(new Request(url, { headers: { cookie: cookie + 'tampered' } }))).status, 401);
  assert.equal((await route.POST(new Request(url, { method: 'POST', headers: { cookie, origin: 'https://other.example' }, body: '{}' }))).status, 403);
});

test('WhatsApp sends a bounded batch and remembers only those product IDs as shown', async () => {
  const t = setup();
  t.setHandler(() => ({ reply: 'A few matching designs', display: 'product_images', searchQuery: 'Glass Bangles' }));
  const result = await t.engine.answerWithModelDrivenSalar({ message: 'Glass bangles', channel: 'whatsapp', productLimit: 3 });
  assert.equal(result.products.length, 3);
  assert.equal(result.matchingProductCount, 47);
  assert.equal(result.context.shownProductIds.length, 3);
  assert.match(t.prompts[0][0].content, /CHANNEL: WhatsApp/);
});
