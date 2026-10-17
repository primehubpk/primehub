import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html',root),'utf8');
const js = readFileSync(new URL('app.js',root),'utf8');
const appJs = readFileSync(new URL('apps.js',root),'utf8');

test('startup initializes buttons and create-post view navigates', async t => {
  const errors=[];
  const v=new JSDOM(html,{url:'https://primehub-social-ai.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=v.window; t.after(()=>v.window.close());
  w.scrollTo=()=>{};
  w.confirm=()=>true;
  w.addEventListener('error',e=>errors.push(String(e.error||e.message)));
  w.eval(js);
  w.eval(appJs);
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

test('owner can add HTTPS application, open and remove shortcut without storing credentials', async t => {
  const v=new JSDOM(html,{url:'https://primehub-social-ai.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=v.window; t.after(()=>v.window.close());w.scrollTo=()=>{};w.confirm=()=>true;
  w.eval(js);w.eval(appJs);
  await new Promise(resolve=>setTimeout(resolve,100));
  w.document.querySelector('[data-view="apps"]').click();
  assert.ok(w.document.querySelector('#view-apps').classList.contains('active'));
  w.document.querySelector('#appName').value='My editing app';
  w.document.querySelector('#appUrl').value='https://www.canva.com/';
  w.document.querySelector('#addAppForm button[type="submit"]').click();
  const apps=JSON.parse(w.localStorage.getItem('primehub-social-custom-apps-v1'));
  assert.equal(apps.length,1);
  assert.equal(apps[0].name,'My editing app');
  const link=w.document.querySelector('#customApps a');
  assert.equal(link.href,'https://www.canva.com/');
  assert.equal(link.target,'_blank');
  assert.ok(link.rel.includes('noopener'));
  w.document.querySelector('[data-del-app]').click();
  assert.equal(JSON.parse(w.localStorage.getItem('primehub-social-custom-apps-v1')).length,0);
  w.close();
});
