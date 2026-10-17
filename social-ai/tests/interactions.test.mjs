import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html',root),'utf8');
const js = readFileSync(new URL('app.js',root),'utf8');

test('startup initializes buttons and create-post view navigates', async () => {
  const errors=[];
  const v=new JSDOM(html,{url:'https://primehub-social-ai.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=v.window;
  w.scrollTo=()=>{};
  w.confirm=()=>true;
  w.addEventListener('error',e=>errors.push(String(e.error||e.message)));
  w.eval(js);
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(errors.length,0,'Runtime script errors: '+errors.join(' | '));
  const button=w.document.querySelector('.top-create');
  assert.ok(button);
  button.click();
  assert.ok(w.document.querySelector('#view-compose').classList.contains('active'),'create post view should be visible');
  assert.equal(w.document.querySelector('#crumbName').textContent,'Create post');
  w.document.querySelector('#postTitle').value='Test bangles';
  w.document.querySelector('#postCaption').value='Test caption from QA';
  w.document.querySelector('#saveDraft').click();
  assert.ok(w.document.querySelector('#view-queue').classList.contains('active'),'saving draft should show library');
  const data=JSON.parse(w.localStorage.getItem('primehub-social-v1'));
  assert.equal(data.length,1);
  assert.equal(data[0].title,'Test bangles');
  w.close();
});
