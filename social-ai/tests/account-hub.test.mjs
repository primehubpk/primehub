import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const source=readFileSync(new URL('../account-hub.js',import.meta.url),'utf8');
function harness(){
  class Element{
    constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.textContent='';this.className='';this.style={};this.href='';this.target='';this.rel='';}
    appendChild(e){this.children.push(e);return e;}
    replaceChildren(...c){this.children=c;}
    addEventListener(name,fn){this.listeners[name]=fn;}
    reset(){this.resetCalls=(this.resetCalls||0)+1;}
    fire(name){this.listeners[name]({preventDefault(){}});}
  }
  const els=Object.fromEntries(['tiktokSavedShortcuts','tiktokAccountShortcutForm','tiktokShortcutLabel','tiktokShortcutHandle','tiktokOfficialStatus'].map(i=>[i,new Element(i)]));
  const map=new Map();
  const reports=[];
  const ctx={
    document:{createElement:t=>new Element(t),getElementById:id=>els[id]||null},
    localStorage:{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v))},
    window:{PrimeHubSocial:{notify:(s,err)=>reports.push({s,err})}},
    Date,Math,crypto:{randomUUID:()=>String(map.size+100)+'-uuid'},Error,
    fetch:async()=>({ok:true,json:async()=>({loginKitReady:false})}),
    AbortSignal
  };
  vm.runInNewContext(source,ctx);
  return {els,map,reports,ctx};
}
test('multiple TikTok shortcuts are only device-local labels, never provider credentials',()=>{
 const h=harness();
 h.els.tiktokShortcutLabel.value='PrimeHub Official';h.els.tiktokShortcutHandle.value='@primehubmall';
 h.els.tiktokAccountShortcutForm.fire('submit');
 h.els.tiktokShortcutLabel.value='Wholesale channel';h.els.tiktokShortcutHandle.value='@primehubwholesale';
 h.els.tiktokAccountShortcutForm.fire('submit');
 const data=JSON.parse(h.map.get('primehub-social-tiktok-shortcuts-v1'));
 assert.equal(data.length,2);
 assert.deepEqual(data.map(x=>x.label),['Wholesale channel','PrimeHub Official']);
 assert.ok(h.els.tiktokSavedShortcuts.children.length===2);
 assert.ok(JSON.stringify([...h.map.entries()]).indexOf('password')===-1);
 assert.ok(JSON.stringify([...h.map.entries()]).indexOf('cookie')===-1);
});
test('shortcut saves never claim to have verified the TikTok session',()=>{
 const h=harness();
 h.els.tiktokShortcutLabel.value='TikTok A';
 h.els.tiktokShortcutHandle.value='@channelA';
 h.els.tiktokAccountShortcutForm.fire('submit');
 const row=h.els.tiktokSavedShortcuts.children[0];
 assert.ok(row.children[0].children.some(x=>x.textContent.includes('unverified')));
 const hrefs=row.children[1].children.filter(x=>x.href).map(x=>x.href);
 assert.deepEqual(hrefs,['https://www.tiktok.com/@channelA','https://www.tiktok.com/login']);
 assert.equal(h.ctx.window.PrimeHubTikTokHub.getPreferredLabel(),'TikTok A');
});
test('duplicate handles, invalid TikTok usernames, and HTML labels cannot compromise markup',()=>{
 const h=harness();
 h.els.tiktokShortcutLabel.value='<script>alert(1)</script>';h.els.tiktokShortcutHandle.value='@bad/evil';
 h.els.tiktokAccountShortcutForm.fire('submit');
 assert.equal(h.els.tiktokSavedShortcuts.children.length,1); // empty placeholder only
 assert.ok(!h.map.has('primehub-social-tiktok-shortcuts-v1'));
 h.els.tiktokShortcutHandle.value='@goodaccount';
 h.els.tiktokAccountShortcutForm.fire('submit');
 assert.equal(h.els.tiktokSavedShortcuts.children[0].children[0].children[0].textContent,'<script>alert(1)</script>');
 assert.equal(h.els.tiktokSavedShortcuts.children[0].children[0].children[0].children.length,0);
 h.els.tiktokShortcutLabel.value='Duplicate';h.els.tiktokShortcutHandle.value='goodaccount';
 h.els.tiktokAccountShortcutForm.fire('submit');
 assert.equal(JSON.parse(h.map.get('primehub-social-tiktok-shortcuts-v1')).length,1);
});
test('preferred label does not secretly switch real browser accounts',()=>{
 const h=harness();
 for(const [label,handle] of [['One','oneuser'],['Two','twouser']]){
   h.els.tiktokShortcutLabel.value=label;h.els.tiktokShortcutHandle.value=handle;h.els.tiktokAccountShortcutForm.fire('submit');
 }
 let row=h.els.tiktokSavedShortcuts.children[0]; // Two
 row.children[1].children[0].fire('click');
 assert.equal(h.ctx.window.PrimeHubTikTokHub.getPreferredLabel(),'Two');
 assert.ok(h.reports.some(x=>x.s.includes('TikTok account switching still happens on TikTok')));
});
