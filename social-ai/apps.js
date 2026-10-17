'use strict';
/**
 * Application shortcut manager.
 * Browser sessions belong to the provider websites, never to this app.
 * This local-first launcher does not embed, scrape or claim connection to those sites.
 */
const Social=window.PrimeHubSocial;
if(!Social) throw new Error('Social studio must load before the app launcher');
Social.titles.apps='My applications';
const APP_HUB_KEY='primehub-social-custom-apps-v1';
const APP_PRESETS=[
  {name:'Meta Business Suite',url:'https://business.facebook.com/',badge:'M',tag:'Social'},
  {name:'Facebook',url:'https://www.facebook.com/',badge:'f',tag:'Social'},
  {name:'Instagram',url:'https://www.instagram.com/',badge:'◎',tag:'Social'},
  {name:'TikTok Studio',url:'https://www.tiktok.com/tiktokstudio',badge:'♪',tag:'Social'},
  {name:'YouTube Studio',url:'https://studio.youtube.com/',badge:'▶',tag:'Social'},
  {name:'Google Business',url:'https://business.google.com/',badge:'G',tag:'Business'},
  {name:'WhatsApp Web',url:'https://web.whatsapp.com/',badge:'◉',tag:'Messaging'},
  {name:'Canva',url:'https://www.canva.com/',badge:'C',tag:'Design'},
  {name:'CapCut',url:'https://www.capcut.com/',badge:'✂',tag:'Video'},
  {name:'Pinterest',url:'https://www.pinterest.com/',badge:'P',tag:'Social'},
  {name:'Metricool',url:'https://app.metricool.com/',badge:'M',tag:'Planner'},
  {name:'Windsor.ai',url:'https://onboard.windsor.ai/',badge:'W',tag:'Analytics'},
  {name:'GitHub',url:'https://github.com/',badge:'⌘',tag:'Code'},
  {name:'Vercel',url:'https://vercel.com/dashboard',badge:'▲',tag:'Hosting'},
  {name:'Supabase',url:'https://supabase.com/dashboard',badge:'S',tag:'Database'},
  {name:'PrimeHubMall',url:'https://www.primehubmall.com/',badge:'PH',tag:'Store'}
];
function safeAppUrl(raw){
  const input=String(raw||'').trim();
  if(input.length>400)throw Error('URL must be under 400 characters.');
  let parsed;
  try{parsed=new URL(input)}catch{throw Error('Enter the complete HTTPS website address.')}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port)throw Error('Use a normal HTTPS URL without passwords or custom ports.');
  const domain=parsed.hostname.toLowerCase();
  if(!domain.includes('.')||domain==='localhost'||domain.endsWith('.local')||/^\d+\.\d+\.\d+\.\d+$/.test(domain)||domain.includes('..'))throw Error('Use a real public website, not a local/private address.');
  return parsed.href;
}
function cleanEntry(x){
  if(!x||typeof x!=='object'||typeof x.name!=='string'||typeof x.url!=='string'||typeof x.id!=='string')return null;
  try{
    return {id:String(x.id).slice(0,75),name:x.name.trim().slice(0,45),url:safeAppUrl(x.url)};
  }catch{return null;}
}
function readCustomApps(){
  try{
    const data=JSON.parse(localStorage.getItem(APP_HUB_KEY)||'[]');
    return Array.isArray(data)?data.map(cleanEntry).filter(x=>x&&x.name&&x.name.length>=2).slice(0,100):[];
  }catch{return []}
}
let customApps=readCustomApps();
function saveCustomApps(){
  try{localStorage.setItem(APP_HUB_KEY,JSON.stringify(customApps));return true}
  catch{Social.notify('Could not save applications: browser storage is blocked or full.',true);return false}
}
function appCard(a,isCustom=false){
  let domain='Website';
  try{domain=new URL(a.url).hostname.replace(/^www\./,'')}catch{}
  return '<div class="app-row"><div class="app-icon">'+Social.escape(a.badge||a.name.slice(0,2).toUpperCase())+'</div><div class="app-title"><strong>'+Social.escape(a.name)+'</strong><small>'+Social.escape(domain)+(a.tag?' · '+Social.escape(a.tag):'')+'</small></div><div class="app-links"><a class="mini primary" target="_blank" rel="noopener noreferrer" href="'+Social.escape(a.url)+'" title="Open the original website and sign in">Open & sign in ↗</a>'+(isCustom?'<button class="mini danger" type="button" data-del-app="'+Social.escape(a.id)+'" aria-label="Remove '+Social.escape(a.name)+'">Remove</button>':'')+'</div></div>';
}
function renderAppHub(){
  const builtins=document.getElementById('builtinApps');
  const custom=document.getElementById('customApps');
  if(!builtins||!custom)return;
  builtins.innerHTML=APP_PRESETS.map(a=>appCard(a,false)).join('');
  custom.innerHTML=customApps.length?customApps.map(a=>appCard(a,true)).join(''):'<div class="empty"><strong>＋</strong>Your own apps will appear here.<br>Add a website address above to save a quick sign-in shortcut.</div>';
  document.getElementById('customCount').textContent=String(customApps.length);
}
document.getElementById('addAppForm')?.addEventListener('submit',event=>{
  event.preventDefault();
  const name=document.getElementById('appName').value.trim();
  const input=document.getElementById('appUrl').value;
  if(name.length<2||name.length>45){Social.notify('App name must be between 2 and 45 characters.',true);return;}
  let url;
  try{url=safeAppUrl(input)}catch(error){Social.notify(error.message,true);return}
  if(customApps.some(a=>a.url===url)){Social.notify('You already saved this application.',true);return}
  const newEntry={id:Social.makeId(),name,url};
  customApps.unshift(newEntry);
  if(saveCustomApps()){
    event.target.reset();
    renderAppHub();
    Social.notify('Application added. Open it and sign in on its official website.');
  }else customApps.shift();
});
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-del-app]');
  if(!target)return;
  const app=customApps.find(x=>x.id===target.dataset.delApp);
  if(!app)return;
  if(!confirm('Remove '+app.name+' from your shortcuts? This does not sign you out of the website.'))return;
  customApps=customApps.filter(x=>x.id!==app.id);
  saveCustomApps();renderAppHub();Social.notify('Application shortcut removed.');
});
renderAppHub();
