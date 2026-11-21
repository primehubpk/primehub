import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const normalizeCode=ts.transpileModule(fs.readFileSync('lib/imageUrl.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const imageUrl=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(normalizeCode));
const source=ts.transpileModule(fs.readFileSync('components/shop/CategoryFilter.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const exports={};
vm.runInNewContext(source,{exports,require:name=>{
 if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 if(name==='@/lib/imageUrl')return imageUrl;
 if(name==='@/lib/categoryUtils')return {categoryHref:()=>'/category/glass-bangles',productMatchesCategory:()=>false};
 if(name==='next/link')return {default:'a'};
 if(name==='lucide-react')return {ChevronRight:'svg'};
 throw Error('Unexpected category-filter dependency '+name);
}});
function images(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(images);return [...(node.type==='img'?[node.props.src]:[]),...images(node.props?.children)];}
test('category thumbnail hosts render identically from server and client catalog aliases',()=>{
 const legacy='https://pub-157b90419bf04016bdea666e4cbce181.r2.dev/categories/glass.webp';
 const custom='https://images.primehubmall.com/categories/glass.webp';
 for(const field of ['iconUrl','imageUrl','image']){
  const input={id:'glass',name:'Glass bangles',[field]:custom};
  const before=structuredClone(input);
  const client=exports.default({categories:[input],category:'all'});
  const server=exports.default({categories:[{...input,[field]:legacy}],category:'all'});
  assert.deepEqual(images(client),[legacy]);
  assert.deepEqual(images(server),images(client));
  assert.deepEqual(input,before,'Rendering must not rewrite catalog data');
 }
});
