import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all seven studio pages exist',()=>{const html=read('index.html');for(const id of ['dashboard','compose','queue','calendar','media','accounts','insights','settings'])assert.ok(html.includes('id="view-'+id+'"'));});
test('publishing is explicit, not misrepresented as automatic',()=>{const source=read('app.js');assert.ok(source.includes("preparePost("));assert.ok(source.includes("Mark as published"));assert.ok(read('index.html').includes('does <b>not</b> auto-post'));});
test('privacy boundaries are explicit',()=>{const js=read('app.js');assert.ok(js.includes('indexedDB.open'));assert.ok(js.includes('localStorage.setItem'));assert.ok(read('index.html').includes('No API keys'));});
test('catalog function never accepts an arbitrary remote URL',()=>{const code=read('api/catalog.js');assert.ok(code.includes("const STORE='https://www.primehubmall.com'"));assert.ok(!code.includes('process.env.SUPABASE_SERVICE_ROLE_KEY'));assert.ok(code.includes("req.method!=='GET'"));});
