import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadTs(path, modules = {}) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: (name) => {
      if (name === 'server-only') return {};
      if (name === 'next/cache') return { unstable_cache: fn => fn };
      if (modules[name]) return modules[name];
      throw new Error('Unexpected dependency ' + name);
    },
    TextEncoder, TextDecoder, URL, Uint8Array, Uint32Array, DataView, ReadableStream, console,
  }, { filename: path });
  return exports;
}

const category = loadTs('lib/categoryUtils.ts');
const gallery = loadTs('lib/resellerImageGallery.ts', {
  '@/lib/dualReadServer': { getDualFeedCatalog: async () => ({}) },
  '@/lib/publicCatalogServer': { getPublicCatalogSnapshot: async () => ({}) },
  '@/lib/imageUrl': { normalizeImageUrl: url => url },
  '@/lib/categoryUtils': category,
});
const zip = loadTs('lib/resellerZipStream.ts');

test('Only approved image CDNs are downloaded, never an arbitrary host or insecure URL', () => {
  assert.equal(gallery.downloadableImageUrl('https://images.primehubmall.com/cat/img.jpg'), 'https://images.primehubmall.com/cat/img.jpg');
  for (const url of [
    'http://images.primehubmall.com/photo.png',
    'https://images.primehubmall.com.evil.test/photo.png',
    'https://127.0.0.1/admin',
    'https://images.primehubmall.com:444/photo.jpg',
    'data:image/png;base64,AAAA',
  ]) assert.equal(gallery.downloadableImageUrl(url), '', url);
  assert.equal(gallery.safeDownloadName('../bad/**name'), 'bad-name');
});

test('Category gallery includes visible product galleries and variant photos, dedupes repeats', () => {
  const main = 'https://images.primehubmall.com/photos/main.jpg';
  const extra = 'https://images.primehubmall.com/photos/detail.webp';
  const variant = 'https://images.primehubmall.com/photos/blue.png';
  const categories = [{ id: 'cat-glass', title: 'Glass bangles', active: true },
    { id: 'cat-metal', title: 'Metal bangles', active: true }];
  const products = [
    { id: 'p1', title: 'Glass set', active: true, category: 'Glass bangles',
      imageUrl: main, images: [main, extra], variantMatrix: [{ color: 'Blue', imageUrl: variant }, { imageUrl: main }] },
    { id: 'p2', title: 'Unpublished set', category: 'Glass bangles', published: false, imageUrl: extra },
    { id: 'p3', title: 'Metal set', category: 'Metal bangles', imageUrl: 'https://i.ibb.co/safe.jpg' },
  ];
  const result = gallery.assembleGallery(products, categories);
  assert.equal(result.byCategory['glass-bangles'].length, 3);
  assert.equal(result.byCategory['metal-bangles'].length, 1);
  assert.equal(result.categories.find(cat => cat.slug === 'glass-bangles').count, 3);
  assert.equal(result.byCategory['glass-bangles'][2].url, variant);
  assert.equal(result.byCategory['glass-bangles'][0].filename.endsWith('.jpg'), true);
});

test('ZIP writer creates valid stored entries, central directory and CRC32 without buffering full pack', async () => {
  async function* sample() {
    yield { name: 'glass/first.jpg', bytes: new TextEncoder().encode('abc') };
    yield { name: 'glass/second.png', bytes: new TextEncoder().encode('xyz') };
  }
  const chunks = [];
  for await (const chunk of zip.zipStoredEntries(sample())) chunks.push(chunk);
  const data = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
  const local = data.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const central = data.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  const footer = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.equal(local, 0);
  assert.ok(central > local);
  assert.ok(footer > central);
  assert.equal(data.readUInt16LE(footer + 10), 2);
  assert.equal(data.readUInt32LE(local + 14), 0x352441c2); // CRC32('abc')
  assert.equal(data.readUInt32LE(local + 18), 3);
  assert.equal(data.toString('utf8', 30, 30 + 'glass/first.jpg'.length), 'glass/first.jpg');
  assert.equal(data.readUInt32LE(footer + 16), central);
});
