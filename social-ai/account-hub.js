'use strict';
/* PrimeHub Social AI local TikTok account shortcuts.
 * NEVER stores TikTok passwords, OAuth tokens, cookies or browser sessions.
 * Browser login persists only in TikTok/Chrome, not in this web app.
 */
(function(){
  const KEY='primehub-social-tiktok-shortcuts-v1';
  const LIMIT=12;
  const $=id=>document.getElementById(id);
  const box=$('tiktokSavedShortcuts');
  const form=$('tiktokAccountShortcutForm');
  if(!box||!form)return;
  const make=(tag,cls,txt)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(txt!==undefined)el.textContent=txt;
    return el;
  };
  function cleanHandle(raw){
    const trimmed=String(raw||'').trim().replace(/^@/,'');
    if(!trimmed)return '';
    if(!/^[a-zA-Z0-9._]{2,30}$/.test(trimmed))throw Error('Use a valid TikTok username (letters, numbers, dot or underscore).');
    return trimmed;
  }
  function cleanProfile(value){
    if(!value||typeof value!=='object'||typeof value.label!=='string'||typeof value.id!=='string')return null;
    const label=value.label.trim().slice(0,45);
    if(label.length<2)return null;
    let handle;
    try{handle=cleanHandle(value.handle||'')}catch{return null;}
    if(value.id.length>90)return null;
    return {id:value.id,label,handle,created:Number.isSafeInteger(value.created)?value.created:Date.now()};
  }
  function read(){
    try{const data=JSON.parse(localStorage.getItem(KEY)||'[]');
      return Array.isArray(data)?data.slice(0,LIMIT).map(cleanProfile).filter(Boolean):[];
    }catch{return [];}
  }
  let profiles=read();
  let preferred='';
  try{preferred=localStorage.getItem(KEY+'-preferred')||'';}catch{}
  const notify=(message,isError)=>{
    if(window.PrimeHubSocial&&typeof window.PrimeHubSocial.notify==='function'){
      window.PrimeHubSocial.notify(message,!!isError);
    }else{
      const info=$('tiktokOfficialStatus');
      if(info)info.textContent=message;
    }
  };
  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(profiles));
      localStorage.setItem(KEY+'-preferred',preferred);
      return true;
    }catch{notify('This device cannot save account shortcuts. Check browser storage.',true);return false;}
  }
  function link(url,label){
    const a=make('a','mini',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';
    a.referrerPolicy='no-referrer';return a;
  }
  function render(){
    box.replaceChildren();
    if(!profiles.length){
      box.appendChild(make('div','muted tiktok-shortcut-empty','No account shortcuts saved. Sign in on TikTok first, then save a label here for quick access.'));
      return;
    }
    for(const p of profiles){
      const row=make('div','tiktok-shortcut-card');
      const left=make('div','tiktok-shortcut-title');
      left.appendChild(make('strong','',p.label));
      left.appendChild(make('small','',p.handle?'@'+p.handle+' · saved shortcut (unverified)':'Saved shortcut (unverified)'));
      row.appendChild(left);
      const actions=make('div','tiktok-shortcut-actions');
      const choose=make('button','mini'+(preferred===p.id?' preferred':''),preferred===p.id?'✓ Preferred':'Use for drafts');
      choose.type='button';choose.addEventListener('click',()=>{
        preferred=p.id;if(persist()){render();notify('Preferred label saved. TikTok account switching still happens on TikTok.',false);}
      });actions.appendChild(choose);
      if(p.handle)actions.appendChild(link('https://www.tiktok.com/@'+encodeURIComponent(p.handle),'View profile ↗'));
      actions.appendChild(link('https://www.tiktok.com/login','Sign in / switch ↗'));
      const remove=make('button','mini danger','Remove');
      remove.type='button';remove.addEventListener('click',()=>{
        profiles=profiles.filter(x=>x.id!==p.id);
        if(preferred===p.id)preferred='';
        if(persist()){render();notify('Shortcut removed. TikTok login was not modified.',false);}
      });actions.appendChild(remove);row.appendChild(actions);box.appendChild(row);
    }
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const label=$('tiktokShortcutLabel').value.trim();
    if(label.length<2||label.length>45){notify('Account label must have 2–45 characters.',true);return;}
    if(profiles.length>=LIMIT){notify('Maximum '+LIMIT+' account shortcuts. Remove one before adding more.',true);return;}
    let handle;
    try{handle=cleanHandle($('tiktokShortcutHandle').value);}catch(e){notify(e.message,true);return;}
    if(handle&&profiles.some(p=>p.handle.toLowerCase()===handle.toLowerCase())){notify('This TikTok handle is already saved.',true);return;}
    const id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(16).slice(2);
    profiles.unshift({id,label,handle,created:Date.now()});
    if(profiles.length===1)preferred=id;
    if(persist()){form.reset();render();notify('Account shortcut saved locally. Sign-in must be confirmed on TikTok itself.',false);}
  });
  async function checkOfficialIntegration(){
    const el=$('tiktokOfficialStatus');if(!el)return;
    try{
      const r=await fetch('/api/tiktok-account',{method:'GET',cache:'no-store',credentials:'omit',
        headers:{accept:'application/json'},signal:AbortSignal.timeout(8000)});
      if(!r.ok)throw Error('Server unavailable');
      const v=await r.json();
      el.textContent=v.loginKitReady?
        'Official TikTok Login Kit is configured. To authorize and verify your identity in the Android app, use its TikTok Connect screen. ChatGPT still needs separate posting authorization.':
        'Account verification API not yet configured with TikTok Developer keys. You can still sign in using Chrome and save account shortcuts; ChatGPT cannot see that browser login.';
      el.className='account-link-status'+(v.loginKitReady?' is-ready':'');
    }catch{
      el.textContent='Live account-verification status unavailable. Saved shortcuts remain on this device; no login has been verified.';
    }
  }
  render();checkOfficialIntegration();
  window.PrimeHubTikTokHub={getPreferredLabel:()=>{
    const p=profiles.find(x=>x.id===preferred);return p?p.label:null;
  }};
})();
