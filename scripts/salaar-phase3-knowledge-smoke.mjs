import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourceUrl = new URL('../lib/salaarStoreKnowledgeCore.ts', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const {
  buildSalaarStoreKnowledge,
  directStoreKnowledgeReply,
  storeKnowledgePromptContext,
} = await import(moduleUrl);

const documents = {
  main: {
    storeName: 'PrimeHub',
    priceBuckets: [
      { id: 'under-299', title: 'Under 299', amount: 299, active: true, sortOrder: 1 },
      { id: 'bucket-99', title: '99', amount: 99, active: true, sortOrder: 3 },
      { id: 'wholesale', title: 'Wholesale deal', amount: 0, active: true, sortOrder: 4 },
    ],
    dailyDeal: {
      active: true,
      title: 'Big deal metal water proof dhamaka pro 2',
      dealPrice: 2999,
      originalPrice: 6000,
      productId: 'deal-product',
      buttonLink: '/deals/big',
      buttonText: 'Shop Big Deal',
    },
    weeklyDeals: [
      { id: 'weekly-friday', day: 'friday', active: true, title: 'Metal waterproof deal box', dealPrice: 1299, productId: 'weekly-product' },
    ],
    freeDelivery: JSON.stringify({ enabled: true, itemThreshold: 5, message: 'Add {remaining} more item to unlock FREE DELIVERY' }),
    apiKey: 'MUST_NEVER_LEAK',
  },
  contact: {
    whatsappNumber: '03238878009',
    physicalAddress: 'Prime Hub Lahore',
    secretToken: 'MUST_NEVER_LEAK',
  },
  policy: {
    returnPolicy: 'Return policy is checked according to the real order and item condition.',
    privacyPolicy: 'Customer privacy is protected.',
  },
  futureSalesConfig: {
    installmentPlan: '3 monthly payments available on selected future offers',
    customerNote: 'Ask staff for eligibility',
    privateKey: 'MUST_NEVER_LEAK',
  },
};

const knowledge = buildSalaarStoreKnowledge({
  documents,
  categories: [
    { id: 'glass', name: 'Glass Bangles', slug: 'glass-bangles', active: true },
    { id: 'hidden', name: 'Hidden Category', active: false },
  ],
  skills: [
    { id: 'skill-1', title: 'Bangles Selling Skill', description: 'Practical skill', active: true },
  ],
  sources: { settings: 'supabase', categories: 'supabase', skills: 'firebase' },
  refreshedAt: '2026-09-07T00:00:00.000Z',
});

assert.equal(knowledge.store.name, 'PrimeHub');
assert.equal(knowledge.priceBuckets.length, 3);
assert.equal(knowledge.priceBuckets.find((bucket) => bucket.id === 'bucket-99')?.maxPrice, 99);
assert.equal(knowledge.bigDeal?.dealPrice, 2999);
assert.equal(knowledge.bigDeal?.originalPrice, 6000);
assert.equal(knowledge.weeklyDeals.length, 1);
assert.equal(knowledge.delivery.itemThreshold, 5);
assert.equal(knowledge.delivery.freeDeliveryEnabled, true);
assert.deepEqual(knowledge.categories.map((category) => category.name), ['Glass Bangles']);
assert.deepEqual(knowledge.skills.map((skill) => skill.title), ['Bangles Selling Skill']);

const bigDealReply = directStoreKnowledgeReply('Big Deal kya hai?', knowledge);
assert.ok(bigDealReply?.text.includes('2999'));
assert.equal(bigDealReply?.link?.href, '/deals/big');

const freeDeliveryReply = directStoreKnowledgeReply('free delivery kab milti hai?', knowledge);
assert.ok(freeDeliveryReply?.text.includes('5 items'));

const prompt = storeKnowledgePromptContext(knowledge);
assert.ok(prompt.includes('Big Deal=Big deal metal water proof dhamaka pro 2'));
assert.ok(prompt.includes('Price buckets='));
assert.ok(prompt.includes('settings.futureSalesConfig.installmentPlan=3 monthly payments'));
assert.ok(!prompt.includes('MUST_NEVER_LEAK'));
assert.ok(!knowledge.publicFacts.some((fact) => String(fact.value).includes('MUST_NEVER_LEAK')));

console.log('Salaar Phase 3 store knowledge smoke: PASS');
