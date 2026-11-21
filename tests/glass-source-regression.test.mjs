import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(fs.readFileSync('scripts/glass-image-repair-20261121.json','utf8'));
const catalogManifest=JSON.parse(fs.readFileSync('scripts/catalog-image-repair-20261121.json','utf8'));
const catalogBoxes=JSON.parse(fs.readFileSync('scripts/catalog-image-presentation-20261121.json','utf8'));
const catalogResults=JSON.parse(fs.readFileSync('docs/catalog-source-results.json','utf8'));
const boxes=JSON.parse(fs.readFileSync('scripts/glass-image-presentation-20261121.json','utf8'));
const code=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function loadPreview(env){const exports={};vm.runInNewContext(code('lib/glassImageRestorationPreview.ts'),{exports,process:{env},require:n=>n==='server-only'?{}:n==='node:crypto'?{createHash}:n.includes('glass-image-repair')?{default:manifest}:n.includes('catalog-image-repair')?{default:catalogManifest}:{normalizeImageUrl:s=>String(s||'').replace(/^https:\/\/pub-[a-z0-9]+\.r2\.dev\//,'https://images.primehubmall.com/')}});return exports;}
const presentation={};vm.runInNewContext(code('lib/glassImagePresentation.ts'),{exports:presentation,URL,require:n=>({default:n.includes('catalog-image-presentation')?catalogBoxes:boxes})});
test('all107 reviewed replacements obey the100KB cap and immutable source mapping',()=>{
 assert.equal(manifest.length,107);assert.equal(new Set(manifest.map(r=>r.productId)).size,107);
 assert.equal(manifest.filter(r=>r.sourceKind==='verified-full-original').length,19);
 assert.equal(manifest.filter(r=>r.contentBox).length,82);
 for(const row of manifest){
  assert.ok(row.bytes>0&&row.bytes<=100000);assert.ok(row.width>0&&row.height>0);
  assert.ok(row.newUrl.endsWith('/'+row.sha256+'.webp'));
  assert.ok(row.newUrl.startsWith('https://images.primehubmall.com/products/glass-repair-20261121/'));
  const box=presentation.getGlassContentBox(row.newUrl);
  assert.equal(Boolean(box),Boolean(row.contentBox));
  assert.equal(Boolean(presentation.getGlassContentBox(row.newUrl.replace('images.primehubmall.com','pub-157b90419bf04016bdea666e4cbce181.r2.dev'))),Boolean(row.contentBox));
  if(row.contentBox){assert.ok(box.left+box.width<=box.sourceWidth&&box.top+box.height<=box.sourceHeight);}
 }
});
test('preview restoration replaces the exact old source everywhere without changing commerce data',()=>{
 const api=loadPreview({NODE_ENV:'development'}),row=manifest[0];
 const input={id:row.productId,imageUrl:row.oldUrl,images:[row.oldUrl,{url:row.oldUrl}],variantMatrix:[{imageUrl:row.oldUrl,stock:7,price:999}],price:999,stock:7,availableSizes:['22','24']};
 const old=JSON.stringify(input),out=api.applyGlassImageRestorationPreview(input);
 assert.equal(JSON.stringify(input),old);assert.equal(out.imageUrl,row.newUrl);assert.equal(out.images[1].url,row.newUrl);
 assert.equal(out.variantMatrix[0].imageUrl,row.newUrl);assert.equal(out.variantMatrix[0].stock,7);assert.equal(out.price,999);
 assert.equal(JSON.stringify(out.availableSizes),JSON.stringify(input.availableSizes));
 assert.equal(api.applyGlassImageRestorationPreview({...input,imageUrl:'https://images.primehubmall.com/products/new-admin-upload.webp'}).imageUrl,'https://images.primehubmall.com/products/new-admin-upload.webp');
 assert.equal(api.applyGlassImageRestorationPreview({...input,id:'other'}).imageUrl,row.oldUrl);
});
test('production applies reviewed repairs only for unchanged old sources; newer Admin uploads win',()=>{
 const api=loadPreview({NODE_ENV:'production',VERCEL_ENV:'production'}),input={id:manifest[0].productId,imageUrl:manifest[0].oldUrl};
 const repaired=api.applyGlassImageRestorationPreview(input);
 assert.notEqual(repaired,input);
 assert.equal(repaired.imageUrl,manifest[0].newUrl);
 const laterAdmin={...input,imageUrl:'https://images.primehubmall.com/products/admin-new.webp'};
 assert.equal(api.applyGlassImageRestorationPreview(laterAdmin),laterAdmin);
 const mapped=manifest.find(r=>r.contentBox);
 for(const source of [mapped.oldUrl,mapped.newUrl.replace('images.primehubmall.com','example.com'),'','/local.webp',null])assert.equal(presentation.getGlassContentBox(source),null);
});

test('all other categories retain valid immutable source repairs under100KB',()=>{
 const all=[...manifest,...catalogManifest];
 assert.equal(all.length,349);
 assert.equal(new Set(all.map(r=>r.productId)).size,349);
 assert.equal(catalogResults.records,653);assert.equal(catalogResults.unchanged,411);
 assert.ok(catalogResults.maxBytes<=100000);
 const preview=loadPreview({NODE_ENV:'development'});
 for(const row of catalogManifest){
  assert.ok(row.bytes>0&&row.bytes<=100000);
  assert.equal(preview.applyGlassImageRestorationPreview({id:row.productId,imageUrl:row.oldUrl}).imageUrl,row.newUrl);
  const box=presentation.getGlassContentBox(row.newUrl);
  assert.equal(Boolean(box),Boolean(row.contentBox));
 }
 for(const [key,value] of Object.entries(catalogBoxes))if(boxes[key])assert.equal(JSON.stringify(value),JSON.stringify(boxes[key]),'Shared image hash must describe the same sharp rectangle');
});
