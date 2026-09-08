import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function loadSalesIntent() {
  const source = await text('lib/salaarSalesIntent.ts');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace("import 'server-only';", '');
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);
}

const sales = await loadSalesIntent();
const emptyCatalog = { products: [], categories: [], priceBuckets: [] };

const unclear = sales.parseSalesIntent('bhai ye scene mujhe samajh nahi aa raha kya best rahega', emptyCatalog);
assert.equal(unclear.kind, 'general');
assert.equal(sales.intentNeedsLlm(unclear), true, 'unclear/general customer turns must route to AI');

const recommendation = sales.parseSalesIntent('wife ke gift ke liye classy cheez recommend karo', emptyCatalog);
assert.equal(recommendation.needsReasoning, true);
assert.equal(sales.intentNeedsLlm(recommendation), true, 'recommendation turns must route to AI');

const greeting = sales.parseSalesIntent('salam', emptyCatalog);
assert.equal(sales.intentNeedsLlm(greeting), false, 'simple greeting should stay fast/deterministic');

const aiRouter = await text('lib/salaarAiRouter.ts');
assert.ok(aiRouter.includes('AbortSignal.timeout'));
assert.ok(aiRouter.includes('FAILURE_THRESHOLD'));
assert.ok(aiRouter.includes('cooldownUntil'));
assert.ok(aiRouter.includes('recordFailure'));
assert.ok(aiRouter.includes('recordSuccess'));
assert.ok(aiRouter.includes('getSalaarAiHealthSnapshot'));
assert.ok(aiRouter.includes('availableKeys'));
assert.ok(aiRouter.includes('coolingKeys'));
assert.equal(aiRouter.includes('console.warn(`Salaar ${provider}${vision ? \' vision\' : \'\'} key failed; rotating`, error)'), false, 'provider errors should not dump secrets/request internals');

const catalog = await text('lib/salaarCatalogCache.ts');
assert.ok(catalog.includes('lastGoodSnapshot'));
assert.ok(catalog.includes('readSalaarCatalogBackup'));
assert.ok(catalog.includes('writeSalaarCatalogBackup'));
assert.ok(catalog.includes('memory-last-good'));
assert.ok(catalog.includes('r2-last-good'));
assert.ok(catalog.includes("source: 'unavailable'"));
assert.ok(catalog.includes('getLiveSalaarCatalogSnapshot'));
assert.ok(catalog.includes('return loadFreshSalaarCatalog()'));

const backup = await text('lib/salaarCatalogBackup.ts');
assert.ok(backup.includes('GetObjectCommand'));
assert.ok(backup.includes('PutObjectCommand'));
assert.ok(backup.includes('MAX_BACKUP_AGE_MS'));
assert.ok(backup.includes('validSnapshot'));

const brainHealth = await text('app/api/salaar/brain-health/route.ts');
assert.ok(brainHealth.includes("orchestrator: 'salaar'"));
assert.ok(brainHealth.includes('providerFailover: true'));
assert.ok(brainHealth.includes('providerNamesHiddenFromCustomer: true'));
assert.equal(/api_key|Bearer|sb_publishable|service_role/i.test(brainHealth), false);

const chat = await text('app/api/salaar/chat/route.ts');
assert.ok(chat.includes('Grounded deterministic reply keeps Salaar useful when providers are unavailable.'));
assert.ok(chat.includes('Never invent a price, product, stock state, policy, deal, discount or store fact'));

const plan = await text('SALAAR-NEVER-FAIL-MASTER-PLAN.md');
for (const phase of ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4']) assert.ok(plan.includes(phase));
assert.ok(plan.includes('Salaar remains the orchestrator'));

const css = await text('app/globals.css');
assert.ok(css.includes('/salaar-human-avatar.jpg'), 'selected human Salaar avatar must remain on this branch');

console.log('Salaar Phase 10 never-fail smoke: PASS');
