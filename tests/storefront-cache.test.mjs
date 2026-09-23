import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { fetchPublicStorefront, invalidatePublicStorefront } from '../lib/storefrontClient.ts';

const originalFetch = globalThis.fetch;
const originalNow = Date.now;
afterEach(() => {
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
  invalidatePublicStorefront();
});

test('20 concurrent public readers share one request and independently readable bodies', async () => {
  invalidatePublicStorefront();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ products: [{ id: 'one' }] }); };
  const responses = await Promise.all(Array.from({ length: 20 }, () => fetchPublicStorefront('catalog')));
  const bodies = await Promise.all(responses.map(response => response.json()));
  assert.equal(calls, 1);
  assert.ok(bodies.every(body => body.products[0].id === 'one'));
  assert.deepEqual(await (await fetchPublicStorefront('catalog')).json(), bodies[0]);
  assert.equal(calls, 1);
});

test('a public snapshot expires without caching private reads', async () => {
  invalidatePublicStorefront();
  let now = 1000;
  Date.now = () => now;
  let calls = 0;
  globalThis.fetch = async () => Response.json({ version: ++calls });
  await fetchPublicStorefront('settings');
  now += 60_001;
  assert.equal((await (await fetchPublicStorefront('settings')).json()).version, 2);
});

test('failed requests are retried and never saved as successful data', async () => {
  invalidatePublicStorefront();
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? new Response('Unavailable', { status: 503 }) : Response.json({ gifts: [] });
  assert.equal((await fetchPublicStorefront('rewards')).status, 503);
  assert.equal((await fetchPublicStorefront('rewards')).status, 200);
  assert.equal(calls, 2);
});

test('an admin invalidation defeats a late response from before the write', async () => {
  invalidatePublicStorefront();
  let finishOld;
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    if (calls === 1) return new Promise(resolve => { finishOld = resolve; });
    assert.match(url, /refresh=1/);
    return Response.json({ version: 'new' });
  };
  const old = fetchPublicStorefront('settings');
  invalidatePublicStorefront('settings');
  assert.equal((await (await fetchPublicStorefront('settings')).json()).version, 'new');
  finishOld(Response.json({ version: 'old' }));
  await old;
  assert.equal((await (await fetchPublicStorefront('settings')).json()).version, 'new');
  assert.equal(calls, 2);
});
