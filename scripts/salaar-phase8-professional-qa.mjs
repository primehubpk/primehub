import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function loadTs(path, { stripServerOnly = false } = {}) {
  let source = await text(path);
  if (stripServerOnly) source = source.replace(/^import 'server-only';\s*/m, '');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);
}

const intentModule = await loadTs('lib/salaarSalesIntent.ts', { stripServerOnly: true });
const knowledgeModule = await loadTs('lib/salaarStoreKnowledgeCore.ts');
const memoryModule = await loadTs('lib/salaarSalesMemoryCore.ts');

const {
  parseSalesIntent,
  rankProductsForIntent,
  intentNeedsLlm,
  effectiveProductQuery,
} = intentModule;
const {
  buildSalaarStoreKnowledge,
  directStoreKnowledgeReply,
  storeKnowledgePromptContext,
} = knowledgeModule;
const {
  updateSalaarSalesMemory,
  resolveSalesTurnWithMemory,
  sanitizeSalaarSalesMemory,
} = memoryModule;

const catalog = {
  categories: [
    { id: 'glass', name: 'Glass Bangles', slug: 'glass-bangles', active: true },
    { id: 'jewellery', name: 'Jewellery Collection', slug: 'jewellery', active: true },
    { id: 'pearl-bridal', name: 'Pearl Bridal Sets', slug: 'pearl-bridal-sets', active: true },
  ],
  priceBuckets: [
    { id: 'bucket-99', label: 'Under Rs. 99', maxPrice: 99, active: true },
    { id: 'wholesale-deal', label: 'Wholesale Deal', type: 'wholesale', active: true },
    { id: 'festival-777', label: 'Festival Special 777', maxPrice: 777, active: true },
  ],
  products: [
    { id: 'g99', title: 'Red Glass Bangles', category: 'Glass Bangles', color: 'Red', material: 'Glass', price: 99, stock: 9, active: true, published: true, priceBucketIds: ['bucket-99'] },
    { id: 'g450', title: 'Green Glass Bangles', category: 'Glass Bangles', color: 'Green', material: 'Glass', price: 450, originalPrice: 650, stock: 4, active: true, published: true },
    { id: 'g1200', title: 'Premium Red Glass Bangles', category: 'Glass Bangles', color: 'Red', material: 'Glass', price: 1200, stock: 0, active: true, published: true },
    { id: 'j750', title: 'Gold Jewellery Set', category: 'Jewellery Collection', color: 'Gold', material: 'Metal', price: 750, stock: 7, active: true, published: true, priceBucketIds: ['festival-777'] },
    { id: 'p650', title: 'Pearl Bridal Set', category: 'Pearl Bridal Sets', color: 'White', material: 'Pearl', price: 650, stock: 3, active: true, published: true, priceBucketIds: ['festival-777'] },
    { id: 'w900', title: 'Wholesale Bangle Box', category: 'Glass Bangles', color: 'Mix', material: 'Glass', price: 900, stock: 20, active: true, published: true, isWholesale: true, priceBucketIds: ['wholesale-deal'] },
  ],
};

function ids(items) { return items.map((item) => item.id); }

{
  const intent = parseSalesIntent('mujhe 99 wali products dikhao', catalog);
  assert.equal(intent.kind, 'product_search');
  assert.equal(intent.filters.maxPrice, 99);
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['g99']);
}
{
  const intent = parseSalesIntent('500 se 1000 tak jewellery dikhao', catalog);
  assert.equal(intent.filters.category, 'Jewellery Collection');
  assert.equal(intent.filters.minPrice, 500);
  assert.equal(intent.filters.maxPrice, 1000);
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['j750']);
}
{
  const intent = parseSalesIntent('shadi k liay red 1500 tak options dikhao', catalog);
  assert.equal(intent.filters.color, 'Red');
  assert.equal(intent.filters.maxPrice, 1500);
  assert.equal(intent.wantsProducts, true);
}
{
  const intent = parseSalesIntent('sab se sasti glass bangles dikhao', catalog);
  assert.equal(intent.sortBy, 'cheapest');
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['g99', 'g450', 'w900', 'g1200']);
}
{
  const intent = parseSalesIntent('in stock glass bangles dikhao', catalog);
  assert.equal(intent.filters.inStockOnly, true);
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['g99', 'g450', 'w900']);
}
{
  const intent = parseSalesIntent('wholesale deal dikhao', catalog);
  assert.equal(intent.filters.wholesaleOnly, true);
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['w900']);
}

{
  const intent = parseSalesIntent('Pearl Bridal Sets dikhao', catalog);
  assert.equal(intent.filters.category, 'Pearl Bridal Sets');
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['p650']);
}
{
  const intent = parseSalesIntent('Festival Special 777 dikhao', catalog);
  assert.equal(intent.filters.priceBucketId, 'festival-777');
  assert.equal(intent.filters.maxPrice, 777);
  assert.deepEqual(ids(rankProductsForIntent(catalog.products, intent, [])), ['p650', 'j750']);
}

{
  const history = [{ role: 'customer', text: 'glass bangles dikhao' }];
  assert.equal(effectiveProductQuery('aur dikhao', history, catalog), 'glass bangles dikhao');
  const intent = parseSalesIntent('glass bangles dikhao', catalog);
  assert.equal(rankProductsForIntent(catalog.products, intent, ['g99']).some((item) => item.id === 'g99'), false);
}

{
  const intent = parseSalesIntent('glas bangls dikao plz', catalog);
  assert.equal(intentNeedsLlm(intent), true);
}
{
  assert.equal(parseSalesIntent('COD available hai?', catalog).kind, 'delivery');
  assert.equal(parseSalesIntent('return ho sakta hai?', catalog).kind, 'policy');
  assert.equal(parseSalesIntent('payment stuck hai masla ho raha', catalog).kind, 'support');
  assert.equal(parseSalesIntent('pic dekh ke is jaisa chahiye', catalog).requiresVision, true);
}

{
  const previous = {
    version: 1,
    currentQuery: 'glass bangles dikhao',
    filters: { category: 'Glass Bangles' },
    sortBy: 'relevance',
    lastShownProductIds: ['g99', 'g450'],
    selectedProductId: null,
    comparisonProductIds: [],
    visualSearchQuery: '',
    cart: [{ productId: 'g99', name: 'Red Glass Bangles', quantity: 2 }],
    updatedAt: '2026-09-07T00:00:00.000Z',
  };
  const referenceIntent = parseSalesIntent('2nd wala', catalog);
  const resolved = resolveSalesTurnWithMemory('2nd wala', referenceIntent, previous, catalog.products);
  assert.equal(resolved.selectedProductId, 'g450');

  const cleared = updateSalaarSalesMemory({
    previous,
    message: 'cart clear kar dia',
    resolvedQuery: 'cart clear kar dia',
    intent: parseSalesIntent('cart clear kar dia', catalog),
    shownProductIds: [],
    cart: [],
  });
  assert.deepEqual(cleared.cart, []);
  assert.deepEqual(sanitizeSalaarSalesMemory({ ...previous, cart: [] }).cart, []);
}

{
  const knowledge = buildSalaarStoreKnowledge({
    documents: {
      main: {
        priceBuckets: catalog.priceBuckets,
        dailyDeal: { active: true, title: 'Live Big Deal', dealPrice: 1999, originalPrice: 2999, buttonLink: '/deals/big' },
      },
      futureCampaign: {
        eidBundleMessage: 'Buy 3 selected sets and ask Salaar for the current bundle.',
        campaignCodeLabel: 'Eid Bundle',
        apiKey: 'MUST_NEVER_LEAK',
        secretToken: 'MUST_NEVER_LEAK',
      },
    },
    categories: catalog.categories,
    skills: [{ id: 'future-skill', title: 'Future Admin Skill', active: true }],
    sources: { settings: 'supabase', categories: 'supabase', skills: 'supabase' },
    refreshedAt: '2026-09-07T00:00:00.000Z',
  });
  const prompt = storeKnowledgePromptContext(knowledge);
  assert.ok(prompt.includes('settings.futureCampaign.eidBundleMessage='));
  assert.ok(prompt.includes('Eid Bundle'));
  assert.equal(prompt.includes('MUST_NEVER_LEAK'), false);
  assert.ok(directStoreKnowledgeReply('Big Deal kya hai?', knowledge)?.text.includes('Rs 1,999'));
}

const catalogCache = await text('lib/salaarCatalogCache.ts');
assert.ok(catalogCache.includes('SALAAR_CATEGORY_BATCH_SIZE = 30'));
assert.ok(catalogCache.includes('SALAAR_CATALOG_REVALIDATE_SECONDS = 15 * 60'));
assert.ok(catalogCache.includes("result.source === 'empty' || products.length === 0"));
assert.ok(catalogCache.includes('getLiveSalaarCatalogSnapshot'));

const chatRoute = await text('app/api/salaar/chat/route.ts');
assert.ok(chatRoute.includes('.slice(0, SALAAR_CATEGORY_BATCH_SIZE)'));
assert.ok(chatRoute.includes('Never invent a price, product, stock state, policy, deal, discount or store fact'));
assert.ok(chatRoute.includes('intentNeedsLlm(intent)'));
assert.ok(chatRoute.includes('Grounded deterministic reply keeps Salaar useful when providers are unavailable'));

const aiRouter = await text('lib/salaarAiRouter.ts');
assert.ok(aiRouter.includes("['groq', 'openrouter', 'gemini']"));
assert.ok(aiRouter.includes("['openrouter', 'gemini'"));
assert.ok(aiRouter.includes('google/gemini-2.5-flash'));
assert.ok(aiRouter.includes("'gemini-2.5-flash'"));
assert.ok(aiRouter.includes('isR2PublicUrl'));
assert.ok(aiRouter.includes('.slice(0, 2)'));

const uploadRoute = await text('app/api/salaar/upload-image/route.ts');
assert.ok(uploadRoute.includes("new Set(['image/jpeg', 'image/png', 'image/webp'])"));
assert.equal(uploadRoute.includes("'image/avif']"), false);
assert.ok(uploadRoute.includes('MAX_IMAGE_BYTES = 8 * 1024 * 1024'));
assert.ok(uploadRoute.includes('MAX_STORED_IMAGE_BYTES = 1500 * 1024'));
assert.ok(uploadRoute.includes('MAX_UPLOADS_PER_WINDOW = 8'));

const clientImage = await text('lib/salaarClientImage.ts');
assert.ok(clientImage.includes('MAX_EDGE = 1280'));
assert.ok(clientImage.includes('WEBP_QUALITY = 0.72'));

const adminSession = await text('lib/adminSession.ts');
assert.ok(adminSession.includes('verifySessionCookie'));
assert.ok(adminSession.includes('httpOnly: true'));
const adminLogin = await text('app/api/admin/login/route.ts');
assert.ok(adminLogin.includes('process.env.ADMIN_PASSWORD'));
assert.equal(adminLogin.includes('NEXT_PUBLIC_ADMIN_PASSWORD'), false);
const adminRoute = await text('app/api/admin/salaar/route.ts');
assert.ok(adminRoute.includes('verifyPrimeHubAdminRequest'));

const vercel = await text('vercel.json');
assert.ok(vercel.includes('"feature/salaar-virtual-salesman"'));

console.log('Salaar Phase 8 professional salesman QA: PASS');
