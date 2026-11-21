import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
const exports={};
const source=ts.transpileModule(fs.readFileSync('lib/r2.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,Buffer,process:{env:{}},crypto:globalThis.crypto,require:name=>name==='sharp'?{default:sharp}:{S3Client:class{},PutObjectCommand:class{}}});
test('product upload encoding stays within100000 bytes and keeps the complete portrait',async()=>{
 const width=1000,height=1500,raw=Buffer.alloc(width*height*3);let seed=47;
 for(let i=0;i<raw.length;i++){seed=(seed*1664525+1013904223)>>>0;raw[i]=seed>>>24;}
 const input=await sharp(raw,{raw:{width,height,channels:3}}).png().toBuffer();
 const output=await exports.compressForR2(input);
 const meta=await sharp(output).metadata();
 assert.ok(output.length<=100000);assert.equal(meta.format,'webp');
 assert.ok(Math.abs(meta.width/meta.height-width/height)<0.003,'Natural portrait aspect must remain');
 assert.ok(meta.width<=800&&meta.height<=800);
 console.log(JSON.stringify({productPhotoBytes:output.length,width:meta.width,height:meta.height}));
});
test('small landscape photos are never enlarged or padded into a square',async()=>{
 const input=await sharp({create:{width:120,height:60,channels:3,background:'#ce1437'}}).png().toBuffer();
 const output=await exports.compressForR2(input);const meta=await sharp(output).metadata();
 assert.equal(meta.width,120);assert.equal(meta.height,60);assert.ok(output.length<=100000);
});
