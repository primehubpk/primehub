import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const configUrl = new URL('../lib/salar/providerConfig.ts', import.meta.url).href;
const config = await import(configUrl);
const source = await readFile(new URL('../lib/salar/modelDrivenEngine.ts', import.meta.url), 'utf8');

const fixture = {
  enabled: true,
  instructions: 'Use live store facts.',
  orderInstructions: 'Confirm the bill before asking for details.',
  providerSelection: config.normalizeProviderSelection(null),
  catalogue: { products: [], categories: [], pages: [], storefront: {}, updatedAt: '' },
};

globalThis.__salarTestState = fixture;
globalThis.__providerCredentials = {};

async function engine() {
  const code = stripTypeScriptTypes(source
    .replace("import 'server-only';", '')
    .replace(/import \{ getProviderCredentials[^\n]+\n/, 'const getProviderCredentials = async () => globalThis.__providerCredentials;\n')
    .replaceAll("'@/lib/salar/providerConfig'", JSON.stringify(configUrl))
    .replace(/import \{ getSalarState[^\n]+\n/, 'const getSalarState = async () => globalThis.__salarTestState;\n')
    .replace(/import \{ normalizeSearchText[^\n]+\n/, 'const normalizeSearchText = value => value; const productSearchScore = () => 0;\n'));
  return import(`data:text/javascript;base64,${Buffer.from(code + `\n// ${Math.random()}`).toString('base64')}`);
}

const reply = { reply: 'Assalam-o-Alaikum, kis design ki bangles chahiye?', display: 'none' };
const ok = () => Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] });

function setup() {
  globalThis.__providerCredentials = {
    cloudflare: { keys: ['test-cloudflare'], accountId: 'a'.repeat(32) },
    groq: { keys: ['test-groq-1', 'test-groq-2'] },
  };
  fixture.providerSelection = {
    preferredProvider: 'cloudflare',
    models: { groq: 'test-model' },
  };
}

test('admin credentials define Cloudflare and explicit provider/model preference', () => {
  setup();
  assert.equal(config.providerTargets(false, fixture.providerSelection, globalThis.__providerCredentials)[0].model, '@cf/google/gemma-4-26b-a4b-it');
  const selection = { preferredProvider: 'groq', models: { groq: 'another-model' } };
  assert.equal(config.providerTargets(false, selection, globalThis.__providerCredentials)[0].provider, 'groq');
  assert.equal(config.providerTargets(false, selection, globalThis.__providerCredentials)[0].model, 'another-model');
});

test('manual custom provider uses saved HTTPS OpenAI-compatible base URL', () => {
  const credentials = {
    custom: {
      keys: ['custom-key'],
      baseUrl: 'https://api.example.test/v1',
      label: 'Example AI',
    },
  };
  const selection = { preferredProvider: 'custom', models: { custom: 'example-model' } };
  const target = config.providerTargets(false, selection, credentials)[0];
  assert.equal(target.provider, 'custom');
  assert.equal(target.baseUrl, 'https://api.example.test/v1');
  assert.equal(target.model, 'example-model');
});

test('Cloudflare request uses account endpoint, admin guidance and bounded output', async () => {
  setup();
  const model = await engine();
  globalThis.fetch = async (url, init) => {
    assert.match(url, /accounts\/a{32}\/ai\/v1\/chat\/completions$/);
    const body = JSON.parse(init.body);
    assert.ok(body.messages[0].content.includes(fixture.instructions));
    assert.ok(body.messages[0].content.includes(fixture.orderInstructions));
    assert.equal(body.options.rejectIfBusy, true);
    assert.equal(body.max_completion_tokens, 1200);
    assert.equal(body.chat_template_kwargs.enable_thinking, false);
    return ok();
  };
  const result = await model.answerWithModelDrivenSalar({ message: 'Hello' });
  assert.equal(result.provider, 'cloudflare');
  assert.equal(result.reply, reply.reply);
});

test('auth/quota failure rotates keys; successful model response is preserved', async () => {
  setup();
  globalThis.__providerCredentials.cloudflare.keys = [];
  fixture.providerSelection = { preferredProvider: 'groq', models: { groq: 'test-model' } };
  const model = await engine();
  const keys = [];
  globalThis.fetch = async (_url, init) => {
    keys.push(init.headers.Authorization);
    return keys.length === 1 ? new Response('', { status: 429 }) : ok();
  };
  const result = await model.answerWithModelDrivenSalar({ message: 'Hello' });
  assert.deepEqual(keys, ['Bearer test-groq-1', 'Bearer test-groq-2']);
  assert.equal(result.provider, 'groq');
});

test('manual custom provider calls configured endpoint', async () => {
  globalThis.__providerCredentials = {
    custom: {
      keys: ['custom-key'],
      baseUrl: 'https://api.example.test/v1',
      label: 'Example AI',
    },
  };
  fixture.providerSelection = { preferredProvider: 'custom', models: { custom: 'example-model' } };
  const model = await engine();
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.example.test/v1/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer custom-key');
    return ok();
  };
  const result = await model.answerWithModelDrivenSalar({ message: 'Hello' });
  assert.equal(result.provider, 'custom');
});

test('total outage never becomes a fabricated answer', async () => {
  setup();
  const model = await engine();
  globalThis.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(model.answerWithModelDrivenSalar({ message: 'Hello' }), /No working Salar AI provider/);
});

test('admin connection test never silently falls back', async () => {
  setup();
  const model = await engine();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('', { status: 403 });
  };
  const result = await model.testSalarProvider({ preferredProvider: 'cloudflare' });
  assert.equal(result.ok, false);
  assert.match(result.error, /HTTP 403/);
  assert.equal(calls, 1);
});
