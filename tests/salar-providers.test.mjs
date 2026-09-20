import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const configUrl = new URL('../lib/salar/providerConfig.ts', import.meta.url).href;
const config = await import(configUrl);
const source = await readFile(new URL('../lib/salar/modelDrivenEngine.ts', import.meta.url), 'utf8');
const fixture = { enabled: true, instructions: 'Use live store facts.', orderInstructions: 'Confirm the bill before asking for details.', providerSelection: config.normalizeProviderSelection(null), catalogue: { products: [], categories: [], pages: [], storefront: {}, updatedAt: '' } };
globalThis.__salarTestState = fixture;
async function engine() {
  const code = stripTypeScriptTypes(source
    .replace("import 'server-only';", '')
    .replaceAll("'@/lib/salar/providerConfig'", JSON.stringify(configUrl))
    .replace(/import \{ getSalarState[^\n]+\n/, 'const getSalarState = async () => globalThis.__salarTestState;\n')
    .replace(/import \{ normalizeSearchText[^\n]+\n/, 'const normalizeSearchText = value => value; const productSearchScore = () => 0;\n'));
  return import(`data:text/javascript;base64,${Buffer.from(code + `\n// ${Math.random()}`).toString('base64')}`);
}
const reply = { reply: 'Assalam-o-Alaikum, kis design ki bangles chahiye?', display: 'none' };
const ok = () => Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] });
function setup() {
  for (const name of Object.keys(process.env)) if (/^(CLOUDFLARE|CF_|GROQ|GEMINI|GOOGLE_GEMINI|SALAAR_|OPENROUTER|OPEN_ROUTER)/.test(name)) delete process.env[name];
  process.env.CLOUDFLARE_ACCOUNT_ID = 'a'.repeat(32);
  process.env.CLOUDFLARE_API_TOKEN = 'test-cloudflare';
  process.env.GROQ_API_KEYS = 'test-groq-1,test-groq-2';
  process.env.GROQ_MODEL = 'test-model';
  fixture.providerSelection = config.normalizeProviderSelection(null);
}

test('Cloudflare defaults and explicit provider/model preference', () => {
  setup();
  assert.equal(config.providerTargets(false)[0].model, '@cf/google/gemma-4-26b-a4b-it');
  const selection = { preferredProvider: 'groq', models: { groq: 'another-model' } };
  assert.equal(config.providerTargets(false, selection)[0].provider, 'groq');
  assert.equal(config.providerTargets(false, selection)[0].model, 'another-model');
  process.env.CLOUDFLARE_ACCOUNT_ID = 'invalid';
  assert.equal(config.providerTargets(false)[0].provider, 'groq');
});

test('Cloudflare request uses account endpoint, admin guidance and bounded output', async () => {
  setup(); const model = await engine();
  globalThis.fetch = async (url, init) => {
    assert.match(url, /accounts\/a{32}\/ai\/v1\/chat\/completions$/);
    const body = JSON.parse(init.body);
    assert.ok(body.messages[0].content.includes(fixture.instructions));
    assert.ok(body.messages[0].content.includes(fixture.orderInstructions));
    assert.equal(body.options.rejectIfBusy, true);
    assert.equal(body.max_completion_tokens, 1200);
    return ok();
  };
  const result = await model.answerWithModelDrivenSalar({ message: 'Hello' });
  assert.equal(result.provider, 'cloudflare'); assert.equal(result.reply, reply.reply);
});

test('auth/quota failure rotates keys; successful model response is preserved', async () => {
  setup(); process.env.CLOUDFLARE_API_TOKEN = ''; const model = await engine(); const keys = [];
  globalThis.fetch = async (_url, init) => { keys.push(init.headers.Authorization); return keys.length === 1 ? new Response('', { status: 429 }) : ok(); };
  const result = await model.answerWithModelDrivenSalar({ message: 'Hello' });
  assert.deepEqual(keys, ['Bearer test-groq-1', 'Bearer test-groq-2']); assert.equal(result.provider, 'groq');
  keys.length = 0;
  globalThis.fetch = async (_url, init) => { keys.push(init.headers.Authorization); return ok(); };
  await model.answerWithModelDrivenSalar({ message: 'Hello again' });
  assert.deepEqual(keys, ['Bearer test-groq-2']);
});

test('provider timeout skips redundant keys and reaches next provider', async () => {
  setup(); process.env.CLOUDFLARE_API_TOKENS = 'test-cloudflare,test-cloudflare-2'; const model = await engine(); const urls = [];
  globalThis.fetch = async url => { urls.push(url); if (url.includes('cloudflare')) throw new DOMException('Timed out', 'TimeoutError'); return ok(); };
  const result = await model.answerWithModelDrivenSalar({ message: 'Hello' });
  assert.equal(urls.length, 2); assert.equal(result.provider, 'groq');
});

test('malformed JSON falls back, and total outage never becomes a fabricated answer', async () => {
  setup(); const model = await engine();
  globalThis.fetch = async url => url.includes('cloudflare') ? Response.json({ choices: [{ message: { content: 'broken json' } }] }) : ok();
  assert.equal((await model.answerWithModelDrivenSalar({ message: 'Hello' })).provider, 'groq');
  globalThis.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(model.answerWithModelDrivenSalar({ message: 'Hello' }), /No working Salar AI provider/);
});

test('admin connection test never silently falls back', async () => {
  setup(); const model = await engine(); let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('', { status: 403 }); };
  const result = await model.testSalarProvider({ preferredProvider: 'cloudflare' });
  assert.equal(result.ok, false); assert.match(result.error, /HTTP 403/); assert.equal(calls, 1);
});
