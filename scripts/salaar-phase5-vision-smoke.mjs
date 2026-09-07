import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourceUrl = new URL('../lib/salaarVisionCore.ts', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const {
  parseSalaarVisionAnalysis,
  visionCatalogQuery,
  SALAAR_VISION_ANALYSIS_SYSTEM,
} = await import(moduleUrl);

{
  const analysis = parseSalaarVisionAnalysis('```json\n{"reply":"Ji, red glass bangles jaisi design nazar aa rahi hai.","searchQuery":"red glass bangles floral","category":"Glass Bangles","color":"Red","material":"Glass","styleTerms":["floral","thin","bridal"]}\n```');
  assert.equal(analysis.category, 'Glass Bangles');
  assert.equal(analysis.color, 'Red');
  assert.equal(analysis.material, 'Glass');
  assert.deepEqual(analysis.styleTerms, ['floral', 'thin', 'bridal']);
  assert.ok(visionCatalogQuery('is jaisi dikhao', analysis).toLowerCase().includes('red glass bangles'));
}

{
  const analysis = parseSalaarVisionAnalysis('Ji, image clear hai lekin exact product identify nahi kar sakta.');
  assert.equal(analysis.searchQuery, '');
  assert.ok(analysis.reply.includes('exact product'));
}

assert.ok(SALAAR_VISION_ANALYSIS_SYSTEM.includes('Never claim an exact match'));
assert.ok(SALAAR_VISION_ANALYSIS_SYSTEM.includes('Return ONE JSON object only'));

const uploadRoute = await readFile(new URL('../app/api/salaar/upload-image/route.ts', import.meta.url), 'utf8');
assert.ok(uploadRoute.includes('MAX_IMAGE_BYTES = 8 * 1024 * 1024'));
assert.ok(uploadRoute.includes('MAX_UPLOADS_PER_WINDOW'));
assert.ok(uploadRoute.includes('salaarR2ObjectKey'));
assert.ok(uploadRoute.includes("image/jpeg"));
assert.ok(uploadRoute.includes("image/png"));
assert.ok(uploadRoute.includes("image/webp"));
assert.equal(uploadRoute.includes("'image/avif']"), false);
assert.ok(uploadRoute.includes('Raw AVIF/HEIF is deliberately rejected'));

const widget = await readFile(new URL('../components/SalaarNative.tsx', import.meta.url), 'utf8');
assert.ok(widget.includes("/api/salaar/upload-image"));
assert.ok(widget.includes('ImagePlus'));
assert.ok(widget.includes('imageUrls'));
assert.ok(widget.includes('Image ke bare mein poochain'));

const chatRoute = await readFile(new URL('../app/api/salaar/chat/route.ts', import.meta.url), 'utf8');
assert.ok(chatRoute.includes('SALAAR_VISION_ANALYSIS_SYSTEM'));
assert.ok(chatRoute.includes('visionCatalogQuery'));
assert.ok(chatRoute.includes('runSalaarAi'));
assert.ok(chatRoute.includes('exact match invent nahi karunga'));

const liveRoute = await readFile(new URL('../app/api/salaar/live/route.ts', import.meta.url), 'utf8');
assert.ok(liveRoute.includes('pendingImageUrls'));
assert.ok(liveRoute.includes('imageUrls'));
assert.ok(liveRoute.includes('Message or image required.'));

console.log('Salaar Phase 5 vision smoke: PASS');
